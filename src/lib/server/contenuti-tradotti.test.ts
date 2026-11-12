import { describe, expect, it } from 'vitest';
import { impronta, recensioneTradotta, LINGUE_RECENSIONI } from './contenuti-tradotti';

const originaleIt = { title: 'Ottimi adesivi', comment: 'Arrivati in due giorni, qualità perfetta.' };
const rigaIt = { id: 'r1', tr: { _orig: 'it', _hash: impronta(originaleIt), it: originaleIt, en: { title: 'Great stickers', comment: 'Arrived in two days, perfect quality.' }, fr: { title: 'Super stickers', comment: 'Arrivés en deux jours, qualité parfaite.' } } };
const originaleFr = { comment: 'Très bons autocollants, livraison rapide.' };
const rigaFr = { id: 'r2', tr: { _orig: 'fr', _hash: impronta(originaleFr), it: { comment: 'Adesivi molto buoni, consegna veloce.' }, en: { comment: 'Very good stickers, fast delivery.' }, fr: originaleFr } };

describe('recensioni nella lingua del sito', () => {
	it('le lingue delle recensioni comprendono l\'italiano e tutte le lingue del sito', () => {
		expect(LINGUE_RECENSIONI[0]).toBe('it');
		for (const l of ['en', 'es', 'fr', 'de', 'nl']) expect(LINGUE_RECENSIONI).toContain(l);
	});
	it('recensione italiana: sul sito italiano resta l\'originale, su /us e /fr la traduzione', () => {
		expect(recensioneTradotta(rigaIt, 'it', originaleIt)).toBeNull();
		expect(recensioneTradotta(rigaIt, 'en', originaleIt)).toEqual(rigaIt.tr.en);
		expect(recensioneTradotta(rigaIt, 'fr', originaleIt)).toEqual(rigaIt.tr.fr);
	});
	it('recensione scritta in francese: su /fr l\'originale, sul sito italiano la versione italiana, su /us l\'inglese', () => {
		expect(recensioneTradotta(rigaFr, 'fr', originaleFr)).toBeNull();
		expect(recensioneTradotta(rigaFr, 'it', originaleFr)).toEqual(rigaFr.tr.it);
		expect(recensioneTradotta(rigaFr, 'en', originaleFr)).toEqual(rigaFr.tr.en);
	});
	it('se il testo della recensione cambia, la traduzione vecchia non vale piu\'', () => {
		const cambiata = { comment: 'Testo modificato dopo la traduzione.' };
		expect(recensioneTradotta(rigaFr, 'it', cambiata)).toBeNull();
		expect(recensioneTradotta(rigaFr, 'en', cambiata)).toBeNull();
	});
	it('senza traduzioni si mostra l\'originale', () => {
		expect(recensioneTradotta({ id: 'nuova', tr: {} }, 'de', originaleIt)).toBeNull();
		expect(recensioneTradotta({ id: 'nuova', tr: null }, 'it', originaleIt)).toBeNull();
	});
});
