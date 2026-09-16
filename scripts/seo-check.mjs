#!/usr/bin/env node
/**
 * Controllo SEO delle pagine pubbliche: si lancia contro un sito pubblicato.
 *   node scripts/seo-check.mjs https://stickerprint.it            (produzione: robots index, canonical, sitemap)
 *   node scripts/seo-check.mjs https://stickerprint-web.vercel.app --test   (dominio di test: deve essere tutto noindex)
 * Verifica: titolo presente e unico, meta description, un solo H1, canonical assoluto sul dominio definitivo,
 * robots coerente con l'ambiente, JSON-LD valido (Product con name/image/offers, AggregateRating coerente),
 * nessun riferimento a domini di test nei metadata, sitemap con soli URL che rispondono 200.
 */
const base = (process.argv[2] || '').replace(/\/$/, '');
const testMode = process.argv.includes('--test');
if (!base) { console.error('uso: node scripts/seo-check.mjs <url> [--test]'); process.exit(2); }
const SITE = 'https://stickerprint.it';
/* SEO_HOST=stickerprint.it per provare in locale la configurazione di produzione (npm run preview) */
import http from 'node:http';
import https from 'node:https';
/* fetch di Node ignora l'header Host: con SEO_HOST si passa da http.request */
async function get(url, redirect = 'follow') {
	if (!process.env.SEO_HOST) {
		const r = await fetch(url, { redirect, headers: { 'user-agent': 'seo-check' } });
		return { status: r.status, header: (n) => r.headers.get(n), text: () => r.text() };
	}
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const mod = u.protocol === 'https:' ? https : http;
		const req = mod.request(u, { method: 'GET', headers: { host: process.env.SEO_HOST, 'user-agent': 'seo-check' } }, (res) => {
			let body = ''; res.setEncoding('utf8'); res.on('data', (c) => (body += c));
			res.on('end', () => resolve({ status: res.statusCode, header: (n) => res.headers[n.toLowerCase()] ?? null, text: async () => body }));
		});
		req.on('error', reject); req.end();
	});
}
const PAGES = ['/', '/adesivi-personalizzati', '/adesivi-resinati', '/adesivi-rilievo', '/etichette', '/fogli', '/vetrofanie', '/kit-adesivi', '/aziende', '/campioni', '/offerte', '/prodotti', '/blog', '/chi-siamo', '/support', '/resi'];
const PRIVATE = ['/account', '/checkout', '/dashboard/login', '/login'];

const errors = [], warns = [];
const titles = new Map();
const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
const metas = (html, name) => [...html.matchAll(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]*content="([^"]*)"`, 'g'))].map((m) => m[1]);

for (const path of PAGES) {
	const url = base + path;
	let res, html;
	try { res = await get(url); html = await res.text(); } catch (e) { errors.push(`${path}: fetch fallita (${e.message})`); continue; }
	if (res.status !== 200) { errors.push(`${path}: status ${res.status}`); continue; }
	const title = attr(html, /<title>([^<]*)<\/title>/);
	if (!title) errors.push(`${path}: manca <title>`); else if (titles.has(title)) errors.push(`${path}: titolo uguale a ${titles.get(title)} ("${title}")`); else titles.set(title, path);
	if (title && title.length > 70) warns.push(`${path}: titolo lungo (${title.length} caratteri)`);
	const desc = metas(html, 'description');
	if (!desc.length) errors.push(`${path}: manca la meta description`); else if (desc.length > 1) errors.push(`${path}: ${desc.length} meta description`);
	const h1 = (html.match(/<h1[\s>]/g) || []).length;
	if (h1 !== 1) errors.push(`${path}: ${h1} H1 (ne serve uno)`);
	const canon = attr(html, /<link rel="canonical" href="([^"]+)"/);
	const robots = metas(html, 'robots');
	const xr = res.header('x-robots-tag');
	if (testMode) {
		if (!robots.some((r) => /noindex/.test(r))) errors.push(`${path}: dominio di test senza meta noindex`);
		if (!/noindex/.test(xr || '')) errors.push(`${path}: dominio di test senza X-Robots-Tag noindex`);
	} else {
		if (!canon) errors.push(`${path}: manca il canonical`);
		else if (canon !== (path === '/' ? SITE + '/' : SITE + path)) errors.push(`${path}: canonical ${canon}`);
		if (robots.some((r) => /noindex/.test(r)) || /noindex/.test(xr || '')) errors.push(`${path}: pagina pubblica con noindex`);
	}
	for (const bad of ['meett.it', 'vercel.app', 'localhost']) {
		const head = html.slice(0, html.indexOf('</head>'));
		if (head.includes(bad)) errors.push(`${path}: "${bad}" nei metadata`);
	}
	const og = metas(html, 'og:title');
	if (!og.length) warns.push(`${path}: manca og:title`);
	const ogImg = metas(html, 'og:image');
	if (ogImg.length && !ogImg[0].startsWith('https://')) errors.push(`${path}: og:image non assoluta`);
	/* JSON-LD */
	const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
	for (const s of scripts) {
		let d; try { d = JSON.parse(s); } catch { errors.push(`${path}: JSON-LD non valido`); continue; }
		const nodes = Array.isArray(d) ? d : [d];
		for (const n of nodes) {
			if (n['@type'] === 'Product') {
				if (!n.name || !n.image?.length) errors.push(`${path}: Product senza name o image`);
				if (!n.offers && !n.aggregateRating) errors.push(`${path}: Product senza offers e senza aggregateRating`);
				const ar = n.aggregateRating;
				if (ar) {
					if (!(ar.reviewCount > 0)) errors.push(`${path}: aggregateRating con reviewCount 0`);
					if (+ar.ratingValue > +ar.bestRating || +ar.ratingValue <= 0) errors.push(`${path}: ratingValue fuori scala`);
					const shown = html.match(/(\d[.,]\d)\s*<\/b>\s*<span[^>]*>\s*su 5/);
					if (shown && shown[1].replace(',', '.') !== (+ar.ratingValue).toFixed(1)) errors.push(`${path}: media visibile ${shown[1]} diversa dal JSON-LD ${ar.ratingValue}`);
				}
				if (n.offers?.lowPrice) {
					const p = (+n.offers.lowPrice).toFixed(0);
					if (!html.includes(`a partire da`) && !html.includes(p)) warns.push(`${path}: prezzo ${p} € del JSON-LD non trovato nel testo`);
				}
			}
			if (n['@type'] === 'BreadcrumbList' && !n.itemListElement?.length) errors.push(`${path}: BreadcrumbList vuota`);
		}
	}
	if (!scripts.length && ['/', '/kit-adesivi'].includes(path) || (!scripts.length && /^\/(adesivi|etichette|fogli|vetrofanie)/.test(path))) errors.push(`${path}: manca il JSON-LD`);
}

for (const path of PRIVATE) {
	try {
		const res = await get(base + path, 'manual');
		const html = res.status === 200 ? await res.text() : '';
		const noindex = /noindex/.test(res.header('x-robots-tag') || '') || /name="robots" content="noindex/.test(html);
		if (res.status === 200 && !noindex) errors.push(`${path}: pagina privata senza noindex`);
	} catch { /* ignora */ }
}

/* robots e sitemap */
try {
	const r = await get(base + '/robots.txt'); const t = await r.text();
	if (!testMode && !t.includes(`Sitemap: ${SITE}/sitemap.xml`)) errors.push('robots.txt senza la riga Sitemap');
	const s = await get(base + '/sitemap.xml');
	if (testMode) { if (s.status === 200) errors.push('sitemap.xml presente sul dominio di test'); }
	else {
		if (s.status !== 200) errors.push(`sitemap.xml status ${s.status}`);
		else {
			const xml = await s.text();
			const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((l) => !l.match(/\.(webp|jpg|png)$/));
			if (locs.some((l) => !l.startsWith(SITE))) errors.push('sitemap con URL fuori dal dominio definitivo');
			for (const l of locs) {
				const p = l.replace(SITE, '') || '/';
				const rr = await get(base + p, 'manual');
				if (rr.status !== 200) errors.push(`sitemap: ${p} risponde ${rr.status}`);
			}
			console.log(`sitemap: ${locs.length} URL controllati`);
		}
	}
} catch (e) { errors.push('robots/sitemap: ' + e.message); }

console.log(`\nPagine controllate: ${PAGES.length} · errori: ${errors.length} · avvisi: ${warns.length}`);
for (const w of warns) console.log('  avviso:', w);
for (const e of errors) console.log('  ERRORE:', e);
process.exit(errors.length ? 1 : 0);
