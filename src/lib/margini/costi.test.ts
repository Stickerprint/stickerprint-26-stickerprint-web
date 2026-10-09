/**
 * Test di consumo e costo: puri, senza database, con i listini di default.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINES } from '$lib/pricing/engine';
import { costoRiga, costoSpedizione, leggiTesto, pianoRiga, ricavoRiga, slugListino } from './costi';
import { materiali, perMese, perProdotto, totali } from './aggrega';
import type { OrdineMargine, RigaMargine } from './tipi';

const E = DEFAULT_ENGINES;

describe('consumo delle righe del sito', () => {
	it('adesivi sciolti: metri di bobina da 70 cm, inchiostro sui pezzi, resa sotto il 100%', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', forma: 'sagomato', materiale: 'bianco', finitura: 'nessuna', width_mm: 50, height_mm: 50, qty: 100 }, E);
		expect(c.stato).toBe('ok');
		const k = c.consumo!;
		expect(k.modo).toBe('sciolti');
		expect(k.pezziDaFare).toBe(108);
		expect(k.strisce).toBe(Math.ceil(108 / k.perStriscia));
		expect(k.bobinaM2).toBeCloseTo((k.bobinaMm * 700) / 1e6, 3);
		expect(k.stampaM2).toBeCloseTo((50 * 50 * 108) / 1e6, 3);
		expect(k.utileM2).toBeCloseTo((50 * 50 * 100) / 1e6, 3);
		expect(k.resaPct).toBeGreaterThan(0);
		expect(k.resaPct).toBeLessThan(100);
		expect(k.laminaTipo).toBeNull();
		expect(c.costi.lamina).toBe(0);
		expect(c.costi.totale).toBeCloseTo(c.costi.vinile + c.costi.stampa, 2);
		expect(c.lettura?.fonti.misura).toBe('ordine');
	});

	it('lamina lucida: film su tutta la bobina consumata', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', materiale: 'bianco', finitura: 'lucida', width_mm: 50, height_mm: 50, qty: 100 }, E);
		expect(c.consumo?.laminaTipo).toBe('lucida');
		expect(c.consumo?.laminaM2).toBe(c.consumo?.bobinaM2);
		expect(c.costi.lamina).toBeGreaterThan(0);
	});

	it('rilievo: la vernice UV non e\' lamina', () => {
		const c = costoRiga({ product_slug: 'adesivi_rilievo', materiale: 'bianco', finitura: 'uv-lucida', width_mm: 50, height_mm: 50, qty: 50 }, E);
		expect(c.consumo?.laminaTipo).toBeNull();
	});

	it('resinati: fogli da 10 aghi, resina in grammi su tutti i pezzi del foglio', () => {
		const c = costoRiga({ product_slug: 'adesivi_resinati', materiale: 'bianco', width_mm: 25, height_mm: 25, qty: 100 }, E);
		const k = c.consumo!;
		expect(k.modo).toBe('fogli');
		expect(k.perFoglio % 10).toBe(0);
		expect(k.pezziDaFare).toBe(k.fogli * k.perFoglio);
		expect(k.resinaCm2).toBe(Math.round(6.25 * k.pezziDaFare));
		expect(k.resinaG).toBe(Math.round(6.25 * k.pezziDaFare * 0.15));
		expect(c.costi.resina).toBeCloseTo(k.resinaG * 0.0109, 1);
	});

	it('pezzo piu\' grande della striscia: stima, mai zero', () => {
		const c = costoRiga({ product_slug: 'vetrofanie', materiale: 'trasparente', width_mm: 900, height_mm: 600, qty: 2 }, E);
		expect(c.stato).toBe('stima');
		expect(c.consumo?.modo).toBe('fuori_misura');
		expect(c.costi.totale).toBeGreaterThan(0);
	});

	it('kit: adesivi per kit × kit, piu\' i cavallotti', () => {
		const c = costoRiga({ product_slug: 'kit_adesivi', forma: '4', materiale: 'bianco', finitura: 'lucida', width_mm: 50, qty: 10 }, E);
		expect(c.consumo?.modo).toBe('kit');
		expect(c.consumo?.pezziDaFare).toBe(Math.ceil(40 * 1.08));
		expect(c.consumo?.cavallotti).toBe(11);
	});

	it('la striscia disegnata contiene tutti i pezzi da fare', () => {
		const p = pianoRiga('adesivi_personalizzati', 40, 30, 500, 'sagomato');
		expect(p.ok).toBe(true);
		expect(p.strips.reduce((s, st) => s + st.pieces.length, 0)).toBe(540);
	});
});

describe('ordini manuali: misura e materiale dalla descrizione', () => {
	it('descrizione del calcolatore 🧮', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', product_code: 'STK', description: 'Sagomato · Trasparente · Lucida · 50×30 mm', qty: 200, lamination: 'lucida' }, E);
		expect(c.stato).toBe('ok');
		expect(c.lettura).toMatchObject({ w: 50, h: 30, forma: 'sagomato', materiale: 'trasparente', lamina: 'lucida' });
		expect(c.lettura?.fonti.misura).toBe('descrizione');
		expect(c.consumo?.laminaTipo).toBe('lucida');
	});

	it('scritta a mano in centimetri', () => {
		expect(leggiTesto('10x10 cm, vinile bianco opaco')).toMatchObject({ w: 100, h: 100, unita: 'cm', materiale: 'bianco', lamina: 'opaca' });
		expect(leggiTesto('Ø 5 cm oro')).toMatchObject({ w: 50, h: 50, forma: 'tondo', materiale: 'oro' });
		expect(leggiTesto('bianco super adesivo 60×40')).toMatchObject({ materiale: 'super', unita: 'presunta-mm' });
	});

	it('unita\' non scritta e valori piccoli: centimetri, ed e\' una stima', () => {
		const c = costoRiga({ product_slug: 'etichette', description: 'Etichette 5x3 bianco', qty: 500 }, E);
		expect(c.lettura).toMatchObject({ w: 50, h: 30 });
		expect(c.stato).toBe('stima');
		expect(c.motivo).toMatch(/centimetri/);
	});

	it('materiale non nel listino: stima con il motivo', () => {
		const c = costoRiga({ product_slug: 'etichette', description: '40x30 mm PP lucido', qty: 200 }, E);
		expect(c.stato).toBe('stima');
		expect(c.motivo).toMatch(/PP/);
		expect(c.lettura?.fonti.materiale).toBe('presunto');
	});

	it('misura nel codice prodotto se la riga non la dice', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', product_code: 'STK50', description: 'Logo', qty: 100 }, E, 'Adesivo 50x50 mm bianco');
		expect(c.lettura?.fonti.misura).toBe('codice');
		expect(c.stato).toBe('ok');
	});

	it('senza misura da nessuna parte: manca, con il motivo', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', description: 'Adesivi logo', qty: 10 }, E);
		expect(c.stato).toBe('manca');
		expect(c.motivo).toMatch(/Adesivi logo/);
		expect(c.consumo).toBeNull();
	});

	it('riga di spedizione o grafica: servizio senza materiale', () => {
		const s = costoRiga({ product_slug: '', product_code: 'SPED', description: 'Spedizione corriere', qty: 1 }, E);
		expect(s).toMatchObject({ tipo: 'servizio', spedizione: true, stato: 'ok' });
		expect(costoRiga({ product_slug: '', description: 'Grafica e impianto', qty: 1 }, E)).toMatchObject({ tipo: 'servizio', spedizione: false });
	});
});

describe('spedizione, slug e ricavo', () => {
	it('corriere 7,50 netti solo a carico nostro', () => {
		expect(costoSpedizione({ shipping_method: null, channel: 'ecommerce' })).toBe(7.5);
		expect(costoSpedizione({ shipping_method: 'Corriere a carico del mittente', channel: 'manuale' })).toBe(7.5);
		expect(costoSpedizione({ shipping_method: 'Corriere a carico del destinatario', channel: 'manuale' })).toBe(0);
		expect(costoSpedizione({ shipping_method: 'Consegna diretta Stickerprint', channel: 'manuale' })).toBe(0);
	});
	it('slug e ricavo', () => {
		expect(slugListino('fogli')).toBe('fogli_adesivi');
		expect(slugListino('adesivi-resinati')).toBe('adesivi_resinati');
		expect(ricavoRiga({ total_net: '100.50', discount_amount: 10 })).toBe(90.5);
	});
});

describe('somme', () => {
	const riga = (slug: string, ricavo: number, src: Parameters<typeof costoRiga>[0]): RigaMargine => {
		const costo = costoRiga(src, E);
		const margine = costo.stato === 'manca' ? null : Math.round((ricavo - costo.costi.totale) * 100) / 100;
		return { id: slug + ricavo, number: 'SP-1', product_slug: slug, product_name: slug, product_code: null, description: null, qty: src.qty, ricavo, costo, margine, marginePct: null };
	};
	const ordine = (key: string, data: string, righe: RigaMargine[], corriere = 7.5): OrdineMargine => {
		const prodotti = righe.reduce((s, r) => s + r.ricavo, 0);
		const c = righe.reduce((s, r) => s + r.costo.costi.totale, 0);
		const manca = righe.some((r) => r.margine == null);
		return {
			key, number: key, channel: 'ecommerce', customer: 'x', created_at: data, status: 'consegnato', qty: 1, consegna: 'ours', fattura: null,
			ricavo: { prodotti, servizi: 0, spedizione: 0, express: 0, totale: prodotti }, costo: { vinile: c, stampa: 0, lamina: 0, resina: 0, corriere, totale: c + corriere },
			margine: manca ? null : prodotti - c - corriere, marginePct: null, stato: manca ? 'manca' : 'ok', lette: 0, righe
		};
	};
	const a = ordine('A', '2026-03-10', [riga('adesivi_personalizzati', 100, { product_slug: 'adesivi_personalizzati', materiale: 'bianco', width_mm: 50, height_mm: 50, qty: 100 })]);
	const b = ordine('B', '2026-03-20', [riga('adesivi_resinati', 80, { product_slug: 'adesivi_resinati', materiale: 'oro', width_mm: 25, height_mm: 25, qty: 100 })]);
	const m = ordine('M', '2026-04-02', [riga('adesivi_personalizzati', 50, { product_slug: 'adesivi_personalizzati', qty: 10 })]);

	it('il margine conta solo gli ordini con il costo completo', () => {
		const t = totali([a, b, m]);
		expect(t.fatturato).toBe(230);
		expect(t.calcolato).toBe(180);
		expect(t.daCompletare).toBe(1);
		expect(t.costo.corriere).toBe(15);
		expect(t.margine).toBeCloseTo(180 - t.costo.totale, 2);
	});
	it('materiale per tipo e resina', () => {
		const mt = materiali([a, b, m]);
		expect(mt.vinili.map((v) => v.id).sort()).toEqual(['bianco', 'oro']);
		expect(mt.senzaConsumo).toBe(1);
		expect(mt.resina.g).toBe(b.righe[0].costo.consumo!.resinaG);
		expect(mt.bobinaMm).toBe(a.righe[0].costo.consumo!.bobinaMm + b.righe[0].costo.consumo!.bobinaMm);
	});
	it('per prodotto e per mese', () => {
		const p = perProdotto([a, b, m]);
		expect(p.find((x) => x.slug === 'adesivi_personalizzati')).toMatchObject({ ordini: 2, senzaCosto: 1, ricavo: 150, calcolato: 100 });
		const mesi = perMese([a, b, m], 2026);
		expect(mesi[2].ordini).toBe(2);
		expect(mesi[3]).toMatchObject({ ordini: 1, margine: 0, marginePct: null });
	});
});

describe('pubblicità', () => {
	it('spesa del periodo: un mese o tutto l\'anno, solo i canali con un dato', async () => {
		const { spesaPeriodo, conDato } = await import('./ads');
		const mesi = Array.from({ length: 12 }, (_, i) => i + 1);
		const c = { canale: 'meta' as const, nome: 'Meta', stato: 'ok' as const, motivo: null, mesi };
		expect(spesaPeriodo(c, '9')).toBe(10);
		expect(spesaPeriodo(c, 'anno')).toBe(78);
		const s = { anno: 2026, aggiornato: '', canali: [c, { ...c, canale: 'google' as const, stato: 'non_collegato' as const }, { ...c, canale: 'tiktok' as const, stato: 'storico' as const }] };
		expect(conDato(s).map((x) => x.canale)).toEqual(['meta', 'tiktok']);
		expect(conDato(null)).toEqual([]);
	});
});
