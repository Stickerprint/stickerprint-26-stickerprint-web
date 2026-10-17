/**
 * Elaborazione della posta: per ogni mail nuova capisce cos'e', trova il cliente, misura gli allegati,
 * mette i prezzi e inserisce l'ordine (o la richiesta azienda) in dashboard. Gira alle 9 e alle 15 (cron)
 * e dal bottone "Rielabora" della pagina Posta. Gli ordini entrano direttamente (Mattia, 17/10/2026):
 * al massimo li cancella o li modifica lui. Ogni dubbio finisce in "blocchi", mai nascosto.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { draftFromGroup, emptyCustomer, emptyDraft, r2, type DraftItem, type OrderDraft } from '$lib/dashboard/orderDraft';
import { loadEditorData, saveOrderDraft } from '$lib/server/orders';
import { estraiMail } from './estrai';
import { codiceDaLavorazione, creaContatto, prezzoFisso, trovaContatto, METRICA } from './clienti';
import { misuraPdf, type Misurato } from './misura';
import { caricaMockup, rendiPdf, ritaglia } from './mockup';
import type { AllegatoPosta, EsitoPosta, PostaRiga, RigaEstratta, RigaInserita } from './tipi';

type DB = SupabaseClient;
const norm = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\s_\-().]+/g, '');
const senzaQta = (nome: string) => nome.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\s_-]*\(?\d+\s?(pz|pezzi)\)?\s*$/i, '').trim();
const isPdf = (a: AllegatoPosta) => /\.pdf$/i.test(a.nome) || a.tipo === 'application/pdf';
const isImg = (a: AllegatoPosta) => /\.(png|jpe?g|webp|gif)$/i.test(a.nome) || /^image\//.test(a.tipo);

/** l'allegato a cui si riferisce la riga: nome esatto, poi contenimento, poi l'unico file di stampa rimasto */
function allegatoPer(riga: RigaEstratta, allegati: AllegatoPosta[], usati: Set<string>): AllegatoPosta | null {
	const utili = allegati.filter((a) => isPdf(a) || isImg(a));
	if (riga.file) {
		const k = norm(riga.file);
		const esatto = utili.find((a) => norm(a.nome) === k) ?? utili.find((a) => norm(a.nome).includes(k) || k.includes(norm(a.nome)));
		if (esatto) return esatto;
	}
	const kd = norm(riga.descrizione).slice(0, 12);
	const perDescr = kd.length >= 5 ? utili.find((a) => !usati.has(a.path) && norm(a.nome).includes(kd)) : null;
	if (perDescr) return perDescr;
	const liberi = utili.filter((a) => !usati.has(a.path));
	return liberi.length === 1 ? liberi[0] : null;
}

async function scaricaAllegato(db: DB, a: AllegatoPosta): Promise<Uint8Array | null> {
	const { data } = await db.storage.from('posta-in').download(a.path);
	return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

/** cliente, pagamento e consegna copiati dall'ultimo ordine del contatto; altrimenti dall'anagrafica */
async function bozzaPerContatto(db: DB, contactId: string, methods: Awaited<ReturnType<typeof loadEditorData>>['methods']): Promise<OrderDraft> {
	const { data: rows } = await db.from('orders').select('*').eq('contact_id', contactId).neq('channel', 'ecommerce').order('created_at', { ascending: false }).limit(40);
	const g = rows?.length ? groupOrders(rows as OrderRow[])[0] : null;
	if (g) { const d = draftFromGroup(g, methods); d.items = []; d.terms = []; d.contact_id = contactId; return d; }
	const { data: c } = await db.from('contacts').select('*').eq('id', contactId).maybeSingle();
	const d = emptyDraft();
	d.contact_id = contactId;
	d.customer = { ...emptyCustomer(), name: c?.name ?? '', first_name: c?.first_name ?? '', last_name: c?.last_name ?? '', address: c?.street ?? '', city: c?.city ?? '', cap: c?.zip ?? '', province: c?.province ?? '', country: c?.country ?? 'IT', piva: c?.vat ?? '', cf: c?.fiscal_code ?? '', sdi: c?.sdi ?? '', pec: c?.pec ?? '', email: c?.email ?? '', phone: c?.phone ?? '' };
	return d;
}

export async function elaboraMail(db: DB, m: PostaRiga): Promise<EsitoPosta> {
	const esito: EsitoPosta = { blocchi: [] };
	const testo = (m.testo ?? '').trim() || (m.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	const { estratto, modello } = await estraiMail({ mittente: m.mittente_email, nome: m.mittente_nome, oggetto: m.oggetto, testo, allegati: m.allegati.map((a) => a.nome) });
	esito.estratto = estratto; esito.modello = modello;
	if (estratto.tipo === 'altro') return esito;

	// cliente
	let contatto = await trovaContatto(db, m.mittente_email);
	if (!contatto) {
		contatto = await creaContatto(db, m.mittente_email, m.mittente_nome, estratto);
		if (contatto) esito.blocchi.push(`Cliente non in anagrafica: creato "${contatto.name}" da completare (P.IVA, indirizzo, SDI).`);
	}
	esito.cliente = contatto ? { id: contatto.id, nome: contatto.name, creato: contatto.creato, come: contatto.come } : { id: null, nome: m.mittente_nome ?? m.mittente_email, creato: false, come: 'nessuno' };
	if (!contatto) { esito.blocchi.push('Non sono riuscito a creare il contatto.'); return esito; }

	if (estratto.tipo === 'preventivo') {
		const msg = `${testo.slice(0, 4000)}${m.allegati.length ? `\n\nAllegati (in Posta → ordini dalle mail): ${m.allegati.map((a) => a.nome).join(', ')}` : ''}`;
		const { data } = await db.from('contact_requests').insert({ kind: 'aziende', name: estratto.cliente.nome ?? m.mittente_nome ?? contatto.name, company: estratto.cliente.azienda ?? contatto.name, email: m.mittente_email, phone: estratto.cliente.telefono ?? null, message: `[Dalla mail del ${m.data_mail?.slice(0, 10) ?? m.ricevuta_il.slice(0, 10)}: ${m.oggetto ?? ''}]\n\n${msg}`, status: 'new', contact_id: contatto.id, notes: 'Inserita dall’assistente dalla posta' }).select('id').single();
		if (data) esito.richiesta = { id: data.id }; else esito.blocchi.push('Richiesta non salvata.');
		return esito;
	}

	// ordine
	if (!estratto.righe.length) { esito.blocchi.push('La mail sembra un ordine ma non ho trovato righe: inserire a mano.'); return esito; }
	if (estratto.conferma_preventivo) esito.blocchi.push(`Il cliente conferma un preventivo (${estratto.conferma_preventivo}): controllare le righe contro il preventivo in Fatturazione → Preventivi.`);
	const ed = await loadEditorData(db);
	const draft = await bozzaPerContatto(db, contatto.id, ed.methods);
	const dataMail = (m.data_mail ?? m.ricevuta_il).slice(0, 10);
	draft.date = dataMail;
	const righe: RigaInserita[] = [];
	const usati = new Set<string>();
	const misure = new Map<string, Misurato | null>();
	const rese = new Map<string, Awaited<ReturnType<typeof rendiPdf>> | null>();
	let n = 0;
	for (const r of estratto.righe) {
		const qty = r.quantita ?? (r.file ? Number((r.file.match(/(\d+)\s?pz/i) ?? [])[1]) || null : null);
		const all = allegatoPer(r, m.allegati, usati);
		if (all) usati.add(all.path);
		const base = { codice: codiceDaLavorazione(r.lavorazione).codice, lamination: codiceDaLavorazione(r.lavorazione).lamination };
		if (!qty) esito.blocchi.push(`"${r.descrizione}": quantità non scritta nella mail, messa a 0: da correggere.`);
		// soggetti: dal tracciato del PDF, dall'ingombro, oppure uno solo senza misura
		let sogg: { w: number; h: number; mockup: string | null; fonte: RigaInserita['fonte_misura'] }[] = [];
		if (all && isPdf(all)) {
			if (!misure.has(all.path)) {
				const bytes = await scaricaAllegato(db, all);
				try { misure.set(all.path, bytes ? await misuraPdf(bytes) : null); } catch (e) { misure.set(all.path, null); esito.blocchi.push(`${all.nome}: non misurabile (${(e as Error).message.slice(0, 100)}).`); }
				try { rese.set(all.path, bytes ? await rendiPdf(bytes, 1400) : null); } catch { rese.set(all.path, null); }
			}
			const mis = misure.get(all.path), resa = rese.get(all.path);
			if (mis) {
				if (mis.fonte === 'ingombro') esito.blocchi.push(`${all.nome}: nessun tracciato di taglio, misura dall'ingombro della grafica (abbondanza compresa).`);
				if (mis.soggetti.length > 1) esito.blocchi.push(`${all.nome}: ${mis.soggetti.length} soggetti nel file, una riga per ciascuno con la stessa quantità.`);
				for (const s of mis.soggetti) {
					n++;
					let url: string | null = null;
					if (resa) { try { url = await caricaMockup(db, `posta/${m.id}/${n}.png`, ritaglia(resa, s.boxPt)); } catch { url = null; } }
					sogg.push({ w: s.w, h: s.h, mockup: url, fonte: mis.fonte });
				}
			}
		} else if (all && isImg(all)) {
			n++;
			const bytes = await scaricaAllegato(db, all);
			const url = bytes ? await caricaMockup(db, `posta/${m.id}/${n}-${all.nome.replace(/[^a-z0-9.]+/gi, '_')}`, bytes, all.tipo || 'image/jpeg') : null;
			sogg.push({ w: 0, h: 0, mockup: url, fonte: 'nessuna' });
		}
		if (!sogg.length) {
			sogg.push({ w: 0, h: 0, mockup: null, fonte: r.misura_mm ? 'mail' : 'nessuna' });
			if (!all) esito.blocchi.push(`"${r.descrizione}": nessun allegato abbinato${r.file ? ` (cercavo ${r.file})` : ''}: riga senza misura e senza mockup.`);
		}
		for (const s of sogg) {
			const misuraTxt = s.w && s.h ? `${s.w}x${s.h}mm` : (r.misura_mm ?? '').replace(/\s/g, '') || null;
			const fisso = prezzoFisso(contatto.vat, { descrizione: r.descrizione, misura: s.w && s.h ? { w: s.w, h: s.h } : null, file: all?.nome ?? r.file });
			let prezzo = r.prezzo_unitario ?? null;
			let codice = base.codice, lamination = base.lamination, descr = `${all ? senzaQta(all.nome) : r.descrizione}${misuraTxt && !fisso ? ` ${misuraTxt}` : ''}`;
			if (fisso) { prezzo = prezzo ?? fisso.prezzo; codice = fisso.codice; lamination = 'nessuna'; descr = `${fisso.descrizione}_${all ? senzaQta(all.nome) : r.descrizione}`; }
			if (prezzo == null) {
				prezzo = 0;
				esito.blocchi.push(contatto.vat === METRICA ? `"${descr}": prezzo a 0, manca il listino rivenditori (STICKERPRINT 25.xlsx) in dashboard.` : `"${descr}": prezzo a 0, nessun listino per questo cliente.`);
			}
			const item: DraftItem = { id: null, number: null, code: codice, description: descr.slice(0, 120), qty: qty ?? 0, price: r2(prezzo), lamination, mockup_url: s.mockup };
			draft.items.push(item);
			righe.push({ descrizione: item.description, codice, qty: item.qty, prezzo: item.price, misura: misuraTxt, file: all?.nome ?? null, mockup: !!s.mockup, fonte_misura: fisso && !s.w ? 'regola' : s.fonte, note: r.note });
		}
	}
	const noteMail = [`Inserito dall'assistente dalla mail di ${m.mittente_nome ?? m.mittente_email} del ${dataMail}: "${m.oggetto ?? ''}".`, estratto.urgenza ? `Urgenza: ${estratto.urgenza}.` : '', esito.blocchi.length ? `Da controllare: ${esito.blocchi.join(' ')}` : ''].filter(Boolean).join(' ');
	draft.notes = [draft.notes, noteMail].filter(Boolean).join('\n').slice(0, 2000);
	draft.items = draft.items.map((i) => ({ ...i, qty: Math.max(0, i.qty) }));
	// saveOrderDraft scarta le righe a quantita' 0: le teniamo a 1 con l'avviso, cosi' Mattia le vede e le corregge
	for (const i of draft.items) if (!i.qty) i.qty = 1;
	const r = await saveOrderDraft(db, draft, null, ed);
	if (r.error) { esito.blocchi.push(`Ordine non salvato: ${r.error}`); return esito; }
	esito.ordine = { group: r.group, number: r.numbers[0], righe };
	return esito;
}

/** elabora le mail nuove (o una sola), aggiornando posta_in; torna quante ne ha fatte */
export async function elaboraPosta(db: DB, opts: { id?: string; max?: number } = {}): Promise<{ fatte: number; ordini: number; preventivi: number; errori: number }> {
	let q = db.from('posta_in').select('*').order('data_mail', { ascending: true }).limit(opts.max ?? 25);
	q = opts.id ? q.eq('id', opts.id) : q.eq('stato', 'nuova');
	const { data } = await q;
	const out = { fatte: 0, ordini: 0, preventivi: 0, errori: 0 };
	for (const m of (data ?? []) as PostaRiga[]) {
		try {
			const esito = await elaboraMail(db, m);
			const stato = esito.ordine ? 'ordine' : esito.richiesta ? 'preventivo' : esito.estratto?.tipo === 'altro' ? 'altro' : 'errore';
			await db.from('posta_in').update({ stato, esito, contact_id: esito.cliente?.id ?? null, elaborata_il: new Date().toISOString(), errore: stato === 'errore' ? esito.blocchi.join(' ') : null }).eq('id', m.id);
			out.fatte++; if (esito.ordine) out.ordini++; if (esito.richiesta) out.preventivi++; if (stato === 'errore') out.errori++;
		} catch (e) {
			out.errori++;
			await db.from('posta_in').update({ stato: 'errore', errore: (e as Error).message.slice(0, 500), elaborata_il: new Date().toISOString() }).eq('id', m.id);
		}
	}
	return out;
}
