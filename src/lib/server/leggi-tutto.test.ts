import { describe, expect, it } from 'vitest';
import { leggiTutto } from './leggi-tutto';

/** una tabella finta: restituisce al massimo `tetto` righe per lettura, come Supabase */
function tabella(n: number, tetto: number, conTotale: boolean) {
	const righe = Array.from({ length: n }, (_, i) => i);
	const chiamate: [number, number][] = [];
	const pagina = async (da: number, a: number) => {
		chiamate.push([da, a]);
		return { data: righe.slice(da, Math.min(a + 1, da + tetto)), error: null, count: conTotale ? n : null };
	};
	return { pagina, chiamate };
}

describe('leggiTutto', () => {
	it('prende anche le righe oltre le 1.000 (gli 11 ordini persi dalla Home il 15/11/2026)', async () => {
		const t = tabella(1011, 1000, true);
		const { data, error } = await leggiTutto(t.pagina);
		expect(error).toBeNull();
		expect(data.length).toBe(1011);
		expect(data[1010]).toBe(1010);
		expect(t.chiamate).toEqual([[0, 999], [1000, 1999]]);
	});
	it('sotto le 1.000 righe fa una lettura sola', async () => {
		const t = tabella(340, 1000, true);
		expect((await leggiTutto(t.pagina)).data.length).toBe(340);
		expect(t.chiamate.length).toBe(1);
	});
	it('con il totale regge anche un tetto del server piu\' basso della pagina', async () => {
		const t = tabella(1300, 500, true);
		expect((await leggiTutto(t.pagina)).data.length).toBe(1300);
	});
	it('senza totale si ferma alla prima pagina non piena', async () => {
		const t = tabella(2400, 1000, false);
		expect((await leggiTutto(t.pagina)).data.length).toBe(2400);
		expect(t.chiamate.length).toBe(3);
	});
	it('tabella vuota e errore', async () => {
		expect((await leggiTutto(tabella(0, 1000, true).pagina)).data).toEqual([]);
		const r = await leggiTutto(async () => ({ data: null, error: { message: 'no' } }));
		expect(r.error?.message).toBe('no');
	});
	it('non supera il massimo chiesto', async () => {
		const t = tabella(5000, 1000, true);
		expect((await leggiTutto(t.pagina, 2000)).data.length).toBe(2000);
	});
});
