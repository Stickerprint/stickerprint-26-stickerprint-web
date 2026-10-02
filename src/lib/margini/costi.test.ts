/**
 * Test del costo di produzione: puro, senza database, con i listini di default.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINES } from '$lib/pricing/engine';
import { costoRiga, costoSpedizione, ricavoRiga, riepilogo, slugListino } from './costi';

const E = DEFAULT_ENGINES;

describe('costoRiga', () => {
	it('adesivi sciolti: impagina sulla bobina da 70 e paga materiale + inchiostro', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', materiale: 'bianco', finitura: 'nessuna', width_mm: 50, height_mm: 50, qty: 100 }, E);
		expect(c.stato).toBe('ok');
		expect(c.impaginazione?.modo).toBe('sciolti');
		expect(c.impaginazione?.pezziDaFare).toBe(108);
		expect(c.impaginazione?.strisce).toBe(Math.ceil(108 / (c.impaginazione?.perStriscia ?? 1)));
		expect(c.mq).toBeGreaterThan(0);
		expect(c.laminato).toBe(false);
		expect(c.lamina).toBe(0);
		expect(c.resina).toBe(0);
		expect(c.totale).toBeCloseTo(c.materiale + c.stampa, 2);
		// bobina intera (70 cm) per i cm di striscia: 108 pezzi da 5 cm su una striscia poco alta
		expect(c.mq).toBeLessThan(0.8);
	});

	it('lamina lucida: la lamina si paga su tutta la bobina consumata', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', materiale: 'bianco', finitura: 'lucida', width_mm: 50, height_mm: 50, qty: 100 }, E);
		expect(c.laminato).toBe(true);
		expect(c.lamina).toBeCloseTo(c.mq * E.adesivi_personalizzati.laminate.costM2, 2);
	});

	it('rilievo: la finitura UV non e\' un film, niente lamina', () => {
		const c = costoRiga({ product_slug: 'adesivi_rilievo', materiale: 'bianco', finitura: 'uv-lucida', width_mm: 50, height_mm: 50, qty: 50 }, E);
		expect(c.laminato).toBe(false);
	});

	it('resinati: fogli da 10 aghi e resina sui cm² dei pezzi', () => {
		const c = costoRiga({ product_slug: 'adesivi_resinati', materiale: 'bianco', width_mm: 25, height_mm: 25, qty: 100 }, E);
		expect(c.stato).toBe('ok');
		expect(c.resinato).toBe(true);
		expect(c.impaginazione?.modo).toBe('fogli');
		expect((c.impaginazione?.perFoglio ?? 0) % 10).toBe(0);
		const cm2 = (25 * 25 / 100) * (c.impaginazione?.pezziDaFare ?? 0);
		expect(c.resina).toBeCloseTo(cm2 * (10.9 / 1000) * 0.15, 2);
		expect(c.lamina).toBe(0);
	});

	it('senza misura il costo manca e lo dice', () => {
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', qty: 10 }, E);
		expect(c.stato).toBe('manca');
		expect(c.motivo).toMatch(/misura/);
		expect(c.totale).toBe(0);
	});

	it('materiale sconosciuto: stima con il primo del listino, motivo scritto', () => {
		const c = costoRiga({ product_slug: 'etichette', materiale: 'carta', width_mm: 40, height_mm: 30, qty: 200 }, E);
		expect(c.stato).toBe('stima');
		expect(c.motivo).toMatch(/carta/);
		expect(c.totale).toBeGreaterThan(0);
	});

	it('pezzo piu\' grande della striscia: stima grezza, mai zero', () => {
		const c = costoRiga({ product_slug: 'vetrofanie', materiale: 'trasparente', width_mm: 900, height_mm: 600, qty: 2 }, E);
		expect(c.stato).toBe('stima');
		expect(c.impaginazione?.modo).toBe('nessuno');
		expect(c.totale).toBeGreaterThan(0);
	});

	it('kit: adesivi per kit × kit, con il cavallotto', () => {
		const c = costoRiga({ product_slug: 'kit_adesivi', forma: '4', materiale: 'bianco', finitura: 'lucida', width_mm: 50, qty: 10 }, E);
		expect(c.stato).toBe('stima');
		expect(c.impaginazione?.modo).toBe('kit');
		expect(c.impaginazione?.pezziDaFare).toBe(Math.ceil(40 * 1.08));
	});

	it('slug e ricavo', () => {
		expect(slugListino('fogli')).toBe('fogli_adesivi');
		expect(slugListino('adesivi-resinati')).toBe('adesivi_resinati');
		expect(ricavoRiga({ total_net: '100.50', discount_amount: 10 })).toBe(90.5);
	});

	it('spedizione: 7,50 netti solo quando il corriere e\' a carico nostro', () => {
		expect(costoSpedizione({ shipping_method: null, channel: 'ecommerce' })).toBe(7.5);
		expect(costoSpedizione({ shipping_method: 'Corriere a carico del mittente', channel: 'manuale' })).toBe(7.5);
		expect(costoSpedizione({ shipping_method: 'Corriere a carico del destinatario', channel: 'manuale' })).toBe(0);
		expect(costoSpedizione({ shipping_method: 'Consegna diretta Stickerprint', channel: 'manuale' })).toBe(0);
	});

	it('riepilogo: le righe senza costo contano nel ricavo ma non nel margine', () => {
		const ok = costoRiga({ product_slug: 'adesivi_personalizzati', materiale: 'bianco', width_mm: 50, height_mm: 50, qty: 100 }, E);
		const manca = costoRiga({ product_slug: 'adesivi_personalizzati', qty: 10 }, E);
		const r = riepilogo([{ ricavo: 100, costo: ok }, { ricavo: 50, costo: manca }]);
		expect(r.ricavo).toBe(150);
		expect(r.ricavoConCosto).toBe(100);
		expect(r.senzaCosto).toBe(1);
		expect(r.margine).toBeCloseTo(100 - ok.totale, 2);
	});
});
