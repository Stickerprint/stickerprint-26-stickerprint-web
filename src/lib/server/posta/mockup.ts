/**
 * Mockup di riferimento per le righe d'ordine: la pagina del PDF resa in PNG (ritagliata sul soggetto),
 * caricata nel bucket order-files come fa il bottone Mockup dell'editor ordini.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PaginaResa { canvas: Canvas; ctx: SKRSContext2D; /** px per pt */ scale: number; pageMm: [number, number] }

/** rende la prima pagina: lato massimo `maxPx` pixel */
export async function rendiPdf(bytes: Uint8Array, maxPx = 1400): Promise<PaginaResa> {
	const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true });
	const doc = await task.promise;
	const page = await doc.getPage(1);
	const vp0 = page.getViewport({ scale: 1 });
	const scale = Math.min(6, maxPx / Math.max(vp0.width, vp0.height));
	const vp = page.getViewport({ scale });
	const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await page.render({ canvasContext: ctx as any, viewport: vp, canvas: canvas as any }).promise;
	page.cleanup();
	await task.destroy();
	return { canvas, ctx, scale, pageMm: [vp0.width * 25.4 / 72, vp0.height * 25.4 / 72] };
}

/** ritaglio del soggetto (riquadro in pt, y verso l'alto) con un po' d'aria attorno, come PNG */
export function ritaglia(r: PaginaResa, boxPt: [number, number, number, number], aria = 0.08): Uint8Array {
	const H = r.canvas.height;
	const x0 = boxPt[0] * r.scale, x1 = boxPt[2] * r.scale, y0 = H - boxPt[3] * r.scale, y1 = H - boxPt[1] * r.scale;
	const m = Math.max(8, (x1 - x0) * aria, (y1 - y0) * aria);
	const sx = Math.max(0, Math.floor(x0 - m)), sy = Math.max(0, Math.floor(y0 - m));
	const sw = Math.min(r.canvas.width - sx, Math.ceil(x1 - x0 + 2 * m)), sh = Math.min(H - sy, Math.ceil(y1 - y0 + 2 * m));
	const out = createCanvas(Math.max(1, sw), Math.max(1, sh));
	const c = out.getContext('2d');
	c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height);
	c.drawImage(r.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
	return new Uint8Array(out.toBuffer('image/png'));
}

/** carica il mockup nel bucket order-files e torna la URL firmata per 5 anni (come l'editor ordini) */
export async function caricaMockup(db: SupabaseClient, path: string, png: Uint8Array, contentType = 'image/png'): Promise<string | null> {
	const { error } = await db.storage.from('order-files').upload(path, png, { contentType, upsert: true });
	if (error) return null;
	const { data } = await db.storage.from('order-files').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
	return data?.signedUrl ?? null;
}
