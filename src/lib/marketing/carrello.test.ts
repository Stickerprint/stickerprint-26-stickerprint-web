import { describe, expect, it } from 'vitest';
import { riassumi, type EventoCarrello } from '$lib/marketing/carrello';

const ev = (creato_il: string, p: Partial<EventoCarrello> = {}): EventoCarrello => ({ id: crypto.randomUUID(), creato_il, visitatore: 'v1', prodotto: 'adesivi_personalizzati', nome: 'Adesivi Personalizzati', forma: null, materiale: null, finitura: null, larghezza_mm: null, altezza_mm: null, qta: 50, netto: 20, lordo: 24.4, sorgente: 'configuratore', promo: null, dispositivo: 'mobile', ...p });

describe('riassumi', () => {
	const oggi = '2026-10-14';
	const eventi = [
		ev('2026-10-14T06:30:00Z'),                                   // oggi (8:30 italiane)
		ev('2026-10-13T22:30:00Z', { visitatore: 'v2' }),             // oggi: 00:30 italiane del 14
		ev('2026-10-13T10:00:00Z', { prodotto: 'kit', nome: 'Kit', lordo: 10, dispositivo: 'desktop' }), // ieri
		ev('2026-10-09T10:00:00Z'),                                   // 6 giorni fa: dentro i 7
		ev('2026-10-07T10:00:00Z'),                                   // 8 giorni fa: nel periodo prima dei 7
		ev('2026-09-01T10:00:00Z')                                    // fuori da tutto
	];
	it('oggi conta con l\'ora italiana e i visitatori diversi', () => {
		const r = riassumi(eventi, 'oggi', oggi);
		expect(r).toMatchObject({ da: oggi, a: oggi, aggiunte: 2, visitatori: 2, pezzi: 100, valore: 48.8 });
		expect(r.prima.aggiunte).toBe(1);
		expect(r.giorni).toHaveLength(1);
	});
	it('ieri', () => {
		const r = riassumi(eventi, 'ieri', oggi);
		expect(r).toMatchObject({ da: '2026-10-13', aggiunte: 1, valore: 10 });
		expect(r.prodotti[0]).toMatchObject({ prodotto: 'kit', aggiunte: 1 });
		expect(r.dispositivi).toEqual([{ nome: 'desktop', aggiunte: 1 }]);
	});
	it('7 giorni, col periodo prima per il confronto', () => {
		const r = riassumi(eventi, '7', oggi);
		expect(r).toMatchObject({ da: '2026-10-08', a: oggi, aggiunte: 4 });
		expect(r.prima.aggiunte).toBe(1);
		expect(r.giorni.map((g) => g.giorno)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
		expect(r.giorni[1].aggiunte).toBe(1);
	});
});
