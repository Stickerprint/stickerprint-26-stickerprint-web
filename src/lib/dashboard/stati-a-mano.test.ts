import { describe, expect, it } from 'vitest';
import { ORDER_STATUS, STATI_A_MANO, statiPerTendina } from './orders';

/* Mattia, 25/11/2026: dalla tendina non si scelgono «spedito» e «in consegna» (li porta Qapla) ne' «annullato» (l'ordine si elimina) */
describe('stati che si scelgono a mano', () => {
	it('quattro stati, tutti esistenti', () => {
		expect(STATI_A_MANO).toEqual(['attesa_pagamento', 'in_produzione', 'in_spedizione', 'consegnato']);
		for (const k of STATI_A_MANO) expect(ORDER_STATUS[k]).toBeTruthy();
	});
	it('la tendina non propone spedito, in consegna e annullato', () => {
		for (const k of ['spedito', 'in_consegna', 'annullato']) expect(statiPerTendina('in_produzione')).not.toContain(k);
	});
	it('un ordine gia\' in uno di quegli stati lo mostra come voce corrente, e da li\' si puo\' solo passare agli altri', () => {
		expect(statiPerTendina('spedito')).toEqual(['spedito', ...STATI_A_MANO]);
		expect(statiPerTendina('annullato')[0]).toBe('annullato');
		expect(statiPerTendina('attesa_prova')[0]).toBe('attesa_prova');
	});
});
