/** Costanti e tipi della gestione ordini in dashboard (condivisi tra server e browser). */
/*
 * STATI DELL'ORDINE (regola del 18/09/2026, niente piu' prove da inviare o approvare):
 *   pagamento acquisito (o preventivo confermato) → in_produzione → in_spedizione → spedito → in_consegna → consegnato
 *   - in_produzione: avanza di reparto in reparto dalla dashboard produzione;
 *   - in_spedizione: uscito dall'ultimo reparto, compare in Spedizioni → "Da spedire" finche' non viene inviato a Qapla o concluso;
 *   - spedito / in_consegna / consegnato: li porta avanti Qapla (webhook e sincronizzazione), con gli stati intermedi in shipping_status;
 *   - consegna diretta Stickerprint: con "Concludi" l'ordine e' subito consegnato;
 *   - corriere del cliente: con "Concludi" l'ordine e' spedito e si ferma li' (non sappiamo quando consegna).
 *   attesa_pagamento resta per gli anticipi degli ordini manuali; annullato per gli annulli.
 * Le chiavi sotto "stati di prima" servono solo a leggere gli ordini vecchi (anche quelli importati dal vecchio sito).
 */
export const ORDER_STATUS: Record<string, { label: string; color: string; soft: string }> = {
	attesa_pagamento: { label: 'In attesa di pagamento', color: '#b45309', soft: '#fef3c7' },
	in_produzione: { label: 'In produzione', color: '#3b82f6', soft: '#e5f0ff' },
	in_spedizione: { label: 'In spedizione', color: '#0d9488', soft: '#dcf9f4' },
	spedito: { label: 'Spedito', color: '#16803c', soft: '#e4f9ea' },
	in_consegna: { label: 'In consegna', color: '#2563eb', soft: '#e5f0ff' },
	consegnato: { label: 'Consegnato', color: '#15803d', soft: '#dcfce7' },
	annullato: { label: 'Annullato', color: '#b3261e', soft: '#fbe3e1' },
	// stati di prima: non si assegnano piu'
	pronto: { label: 'In spedizione', color: '#0d9488', soft: '#dcf9f4' },
	in_attesa: { label: 'In attesa (vecchio flusso)', color: '#6b7280', soft: '#eceef3' },
	attesa_file: { label: 'In attesa di file (vecchio flusso)', color: '#6b7280', soft: '#eceef3' },
	attesa_prova: { label: 'In attesa di prova (vecchio flusso)', color: '#6b7280', soft: '#eceef3' },
	modifiche_richieste: { label: 'Modifiche richieste (vecchio flusso)', color: '#6b7280', soft: '#eceef3' },
	approvazione: { label: 'In approvazione (vecchio flusso)', color: '#6b7280', soft: '#eceef3' }
};
/** dal meno al piu' avanzato: lo stato di un ordine con piu' articoli e' quello dell'articolo piu' indietro */
export const STATUS_RANK = ['in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione', 'attesa_pagamento', 'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato'];
/** gli stati che si possono assegnare a mano dalla scheda ordine */
export const ACTIVE_STATUSES = ['attesa_pagamento', 'in_produzione', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato'];
export const LEGACY_STATUSES = ['pronto', 'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione'];
export const PROD_STAGES: Record<string, string> = { stampa: 'In stampa', plastifica: 'In plastifica', taglio: 'In taglio', resinatura: 'In resinatura', controllo: 'In controllo', confezionamento: 'In confezionamento' };
export const PRODUCTION_STATUSES = ['in_produzione'];
export const SHIPPING_STATUSES = ['pronto', 'in_spedizione', 'spedito', 'in_consegna'];
/** ordine ancora da spedire: uscito dalla produzione ma non ancora inviato a Qapla ne' concluso con il DDT */
export const toShip = (i: { status: string; transmitted_at?: string | null; ddt_id?: string | null }) => (i.status === 'pronto' || i.status === 'in_spedizione') && !i.transmitted_at && !i.ddt_id;

export const CATS: Record<string, { name: string; color: string; soft: string; code: string }> = {
	adesivi_resinati: { name: 'Adesivi Resinati', color: '#3b82f6', soft: '#e5f0ff', code: 'ADR' },
	adesivi_personalizzati: { name: 'Adesivi Personalizzati', color: '#f97316', soft: '#fff1e2', code: 'STK' },
	adesivi_rilievo: { name: 'Adesivi in Rilievo', color: '#8b5cf6', soft: '#efe6ff', code: 'STKR' },
	etichette: { name: 'Etichette in Fogli', color: '#14b8a6', soft: '#dcf9f4', code: 'EAT' },
	fogli_adesivi: { name: 'Fogli di Adesivi', color: '#eab308', soft: '#fef6db', code: 'STKF' },
	vetrofanie: { name: 'Vetrofanie', color: '#06b6d4', soft: '#e0f8fc', code: 'VET' },
	campioni: { name: 'Campioni', color: '#64748b', soft: '#eef0f3', code: 'CMP' }
};
/** Il codice prodotto determina la categoria: i prefissi più lunghi si controllano per primi */
export function categoryFromCode(code: string): string | null {
	const c = (code ?? '').trim().toUpperCase();
	if (!c) return null;
	for (const [slug, cat] of Object.entries(CATS).sort((a, b) => b[1].code.length - a[1].code.length)) if (c.startsWith(cat.code)) return slug;
	return null;
}
export const PAYMENT_METHODS_MANUALI = ['Bonifico immediato vista fattura', 'Ricevuta bancaria 30gg fm', 'Ricevuta bancaria 60gg fm', 'Ricevuta bancaria 90gg fm', 'Bonifico anticipato', 'Personalizzato'];
export const SHIPPING_METHODS = ['Corriere a carico del mittente', 'Corriere a carico del destinatario', 'Consegna diretta Stickerprint'];
/** Corrieri con cui spediamo noi */
export const COURIERS: Record<string, { name: string; logo: string }> = { Qapla: { name: 'Qapla (GLS e altri)', logo: '/icons/couriers/qapla.svg' }, GLS: { name: 'GLS', logo: '/icons/couriers/gls.svg' }, FedEx: { name: 'FedEx', logo: '/icons/couriers/fedex.svg' }, TNT: { name: 'TNT', logo: '/icons/couriers/tnt.svg' } };
/** Come si consegna un ordine: con il nostro corriere, con quello del cliente o a mano */
export function deliveryMode(g: { shipping_method: string | null; channel: string }): 'ours' | 'customer' | 'direct' {
	const m = g.shipping_method ?? '';
	if (/diretta/i.test(m)) return 'direct';
	if (/destinatario/i.test(m)) return 'customer';
	return 'ours';
}
export const COUNTRIES: Record<string, { flag: string; name: string }> = {
	IT: { flag: '🇮🇹', name: 'Italia' }, US: { flag: '🇺🇸', name: 'USA' }, ES: { flag: '🇪🇸', name: 'Spagna' }, DE: { flag: '🇩🇪', name: 'Germania' },
	FR: { flag: '🇫🇷', name: 'Francia' }, GB: { flag: '🇬🇧', name: 'Regno Unito' }, CH: { flag: '🇨🇭', name: 'Svizzera' }, NL: { flag: '🇳🇱', name: 'Olanda' }, AT: { flag: '🇦🇹', name: 'Austria' }, BE: { flag: '🇧🇪', name: 'Belgio' }
};
export const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export interface OrderRow {
	id: string; number: string; user_id: string | null; product_slug: string; product_name: string;
	forma: string | null; materiale: string | null; finitura: string | null; width_mm: number | null; height_mm: number | null;
	qty: number; total_net: number; total_gross: number; credit_earned: number; status: string;
	preview_url: string | null; file_path: string | null; tracking_url: string | null; notes: string | null;
	email: string | null; shipping: Record<string, string> | null; billing: Record<string, string> | null;
	payment_method: string | null; payment_status: string; discount_code: string | null; discount_amount: number; credit_used: number;
	express: boolean; checkout_group: string | null; total_paid: number | null;
	channel: string; starred: boolean; product_code: string | null; description: string | null; unit_net: number | null; price_type: string;
	shipping_method: string | null; delivery_date: string | null; customer_name: string | null; country: string; mockup_url: string | null;
	prod_stage: string | null; internal_notes: string | null; lamination: string | null; created_at: string; updated_at: string;
	device: string | null; user_agent: string | null; proof_url: string | null; imposition_url: string | null; auto_proof: boolean;
	payment_terms: { due: string; amount: number; method: string; xml_code: string }[] | null;
	courier: string | null; shipped_at: string | null; delivered_at: string | null; parcels: number | null; weight_kg: number | null; ddt_id: string | null;
	contact_id?: string | null; transmitted_at?: string | null; labels_generated_at?: string | null; tracking_number?: string | null; courier_label_path?: string | null; manifest_id?: string | null;
	legacy_id?: number | null; shipping_courier?: string | null; shipping_status?: string | null; shipping_status_id?: number | null; shipping_detail?: string | null; shipping_place?: string | null; shipping_updated_at?: string | null; shipping_notified?: string[] | null;
	lead_time?: string | null; ship_by?: string | null; proof_sent_at?: string | null; proof_reminded_at?: string | null; reprints?: number | null;
}
/** Un "ordine" in dashboard = tutte le righe con lo stesso checkout_group */
export interface OrderGroup {
	key: string; number: string; numbers: string[]; channel: string; country: string; customer: string; email: string;
	created_at: string; delivery_date: string | null; status: string; starred: boolean; items: OrderRow[]; device: string | null;
	qty: number; net: number; gross: number; paid: number; express: boolean; payment_method: string | null; shipping_method: string | null;
}
export function groupOrders(rows: OrderRow[]): OrderGroup[] {
	const map = new Map<string, OrderRow[]>();
	for (const r of rows) {
		const k = r.checkout_group ?? r.id;
		if (!map.has(k)) map.set(k, []);
		map.get(k)!.push(r);
	}
	return [...map.entries()].map(([key, items]) => {
		items.sort((a, b) => a.number.localeCompare(b.number));
		const f = items[0];
		const ship = f.shipping ?? {};
		const customer = f.customer_name || [ship.first_name, ship.last_name].filter(Boolean).join(' ') || f.email || '—';
		// stato dell'ordine: il meno avanzato tra gli articoli
		const order = STATUS_RANK;
		const status = items.map((i) => i.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
		return {
			key, number: f.number, numbers: [...new Set(items.map((i) => i.number))], channel: f.channel, country: f.country ?? 'IT', customer, email: f.email ?? '',
			created_at: f.created_at, delivery_date: f.delivery_date, status, starred: items.some((i) => i.starred), items, device: f.device,
			qty: items.reduce((s, i) => s + i.qty, 0), net: items.reduce((s, i) => s + Number(i.total_net), 0), gross: items.reduce((s, i) => s + Number(i.total_gross), 0),
			paid: items.reduce((s, i) => s + Number(i.total_paid ?? 0), 0), express: items.some((i) => i.express), payment_method: f.payment_method, shipping_method: f.shipping_method
		};
	}).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export const money = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
export const dmy = (d: string | null) => (d ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—');
export function itemMeta(i: OrderRow): string {
	if (i.description) return i.description;
	if (i.channel === 'manuale') return '';
	const parts = [i.forma, i.materiale, i.finitura && i.finitura !== 'nessuna' ? `lamina ${i.finitura}` : '', i.width_mm && i.height_mm ? `${i.width_mm}×${i.height_mm} mm` : ''].filter(Boolean);
	return parts.join(' · ');
}

/** Immagine da mostrare per un articolo: prova generata, anteprima o mockup */
export const thumbOf = (i: Pick<OrderRow, 'proof_url' | 'preview_url' | 'mockup_url'>) => i.proof_url ?? i.preview_url ?? i.mockup_url ?? null;
export const DEVICE_ICON: Record<string, string> = { mobile: '📱', tablet: '📱', desktop: '💻' };
export const CHANNEL_ICON: Record<string, { icon: string; label: string }> = { ecommerce: { icon: '🛒', label: 'Ordine e-commerce' }, manuale: { icon: '✏️', label: 'Ordine manuale' } };

/** Flusso di produzione per prodotto (la plastifica solo se c'è la lamina) */
export function stageFlow(item: OrderRow): string[] {
	const lam = (item.finitura && item.finitura !== 'nessuna') || (item.lamination && item.lamination !== 'nessuna');
	switch (item.product_slug) {
		case 'adesivi_resinati': return ['stampa', 'taglio', 'resinatura', 'confezionamento'];
		case 'adesivi_rilievo':
		case 'vetrofanie': return ['stampa', 'taglio', 'confezionamento'];
		case 'campioni': return ['confezionamento'];
		default: return lam ? ['stampa', 'plastifica', 'taglio', 'confezionamento'] : ['stampa', 'taglio', 'confezionamento'];
	}
}
/** Fase successiva: null quando l'articolo esce dalla produzione (pronto per la spedizione) */
export function nextStage(item: OrderRow): string | null {
	const flow = stageFlow(item);
	const i = flow.indexOf(item.prod_stage ?? '');
	return i < 0 ? flow[0] : (flow[i + 1] ?? null);
}
export const STAGE_ICON: Record<string, string> = { stampa: '🖨️', plastifica: '🧴', taglio: '✂️', resinatura: '💧', controllo: '🔍', confezionamento: '📦', spedizione: '🚀' };
