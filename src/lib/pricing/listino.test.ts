import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_ENGINES, quoteWith, lowestPrice, PRODUCT_ENGINES, type EngineConfig } from './engine';
import { listinoIniziale, listinoPubblico, prezzo, finituraListino, problemaListino, normalizzaListino, quantitaProdotto, type Listino } from './listino';

/* Il preventivatore della dashboard (pagina HTML a se') ha la sua copia della regola: qui si controlla che
   il sito calcoli ESATTAMENTE gli stessi prezzi, altrimenti dashboard e sito direbbero cose diverse. */
const html = readFileSync(path.resolve('src/lib/dashboard/simulatore-listino.html'), 'utf8');
const blocco = html.slice(html.indexOf('/*ENGINE-START*/'), html.indexOf('/*ENGINE-END*/'));
const propostaSrc = html.slice(html.indexOf('function proposta(){'), html.indexOf('/*ENGINE-START*/'));
const SIM = new Function(`${propostaSrc}\n${blocco}\nreturn { ENG, proposta };`)() as { ENG: { prezzo: (L: unknown, p: unknown, o: unknown) => { lordo: number; netto0: number } }; proposta: () => Listino };

const attacca = (slug: string, L: Listino): EngineConfig => ({ ...DEFAULT_ENGINES[slug], listino: { L: listinoPubblico(L, slug), slug } });

describe('listino 2027', () => {
	it('il listino iniziale del sito e quello del preventivatore sono lo stesso', () => {
		expect(listinoIniziale()).toEqual(SIM.proposta());
	});

	it('stesso prezzo del preventivatore della dashboard, su tutte le combinazioni', () => {
		const L = listinoIniziale();
		let n = 0;
		for (const p of L.prodotti) {
			const cfg = DEFAULT_ENGINES[p.id];
			for (const m of L.materiali) for (const f of L.finiture) for (const [w, h] of [[20, 20], [40, 40], [50, 50], [55, 85], [100, 100], [200, 150]]) for (const q of [15, 50, 100, 137, 500, 1000, 5000, 132000]) {
				const a = prezzo(L, p, { mat: m.id, fin: f.id, w, h, q });
				const b = SIM.ENG.prezzo(L, p, { mat: m.id, fin: f.id, w, h, q, ex: 0 });
				expect(a.lordo).toBe(b.lordo);
				expect(a.netto0).toBeCloseTo(b.netto0, 9);
				n++;
			}
			expect(cfg).toBeTruthy();
		}
		expect(n).toBeGreaterThan(5000);
	});

	it('quoteWith usa il listino: prezzi di riferimento della proposta', () => {
		const L = listinoIniziale();
		const q = (slug: string, o: Partial<{ w: number; h: number; materiale: string; finitura: string; qty: number }>) =>
			quoteWith(attacca(slug, L), { w: 40, h: 40, forma: 'sagomato', materiale: 'bianco', finitura: 'nessuna', qty: 100, vatIncluded: true, ...o });
		// adesivi personalizzati 40×40 bianco senza lamina (gli stessi numeri della prova mostrata a Mattia)
		expect(q('adesivi_personalizzati', { qty: 15 }).gross).toBe(27.5);
		expect(q('adesivi_personalizzati', { qty: 50 }).gross).toBe(47.5);
		expect(q('adesivi_personalizzati', { qty: 100 }).gross).toBe(74.5);
		expect(q('adesivi_personalizzati', { qty: 200 }).gross).toBe(84.5);
		expect(q('adesivi_personalizzati', { qty: 500 }).gross).toBe(113.5);
		expect(q('adesivi_personalizzati', { qty: 1000 }).gross).toBe(159.5);
		// resinati: 5,5×8,5 cm, 1.000 pezzi, lavoro del carrello compreso
		expect(q('adesivi_resinati', { w: 55, h: 85, qty: 1000 }).gross).toBe(814);
		// il lordo e' sempre un multiplo di 0,50 € e il netto e' il lordo senza IVA
		for (const p of PRODUCT_ENGINES) for (const qty of [15, 50, 100, 333, 1000]) {
			const r = q(p.slug, { qty });
			expect(Math.round(r.gross * 2)).toBe(r.gross * 2);
			expect(r.net).toBeCloseTo(r.gross / 1.22, 2);
			expect(r.perPiece).toBeCloseTo(r.gross / qty, 9);
		}
	});

	it('piu\' pezzi non costano mai meno al totale e mai di piu\' al pezzo', () => {
		const L = listinoIniziale();
		for (const p of PRODUCT_ENGINES) {
			const cfg = attacca(p.slug, L), qs = quantitaProdotto(L.prodotti.find((x) => x.id === p.slug)!);
			let prev: { gross: number; perPiece: number } | null = null;
			for (const qty of qs) {
				const r = quoteWith(cfg, { w: 50, h: 50, forma: 'tondo', materiale: 'bianco', finitura: 'nessuna', qty, vatIncluded: true });
				if (prev) { expect(r.gross).toBeGreaterThanOrEqual(prev.gross); expect(r.perPiece).toBeLessThanOrEqual(prev.perPiece + 1e-9); }
				prev = r;
			}
		}
	});

	it('lamine e vernici UV pagano la lamina, i resinati sempre la resina', () => {
		const L = listinoIniziale();
		const pers = L.prodotti.find((p) => p.id === 'adesivi_personalizzati')!, res = L.prodotti.find((p) => p.id === 'adesivi_resinati')!;
		expect(finituraListino(L, pers, 'lamina', 'nessuna', false)).toBe('nessuna');
		expect(finituraListino(L, pers, 'lamina', 'opaca', true)).toBe('opaca');
		expect(finituraListino(L, pers, 'lamina', 'uv-lucida', true)).toBe('lucida');
		expect(finituraListino(L, res, 'resina', 'nessuna', false)).toBe('resina');
		const senza = quoteWith(attacca('adesivi_personalizzati', L), { w: 50, h: 50, forma: 'tondo', materiale: 'bianco', finitura: 'nessuna', qty: 500, vatIncluded: true });
		const con = quoteWith(attacca('adesivi_personalizzati', L), { w: 50, h: 50, forma: 'tondo', materiale: 'bianco', finitura: 'lucida', qty: 500, vatIncluded: true });
		expect(con.gross).toBeGreaterThan(senza.gross);
		expect(quoteWith(attacca('adesivi_resinati', L), { w: 50, h: 50, forma: 'tondo', materiale: 'bianco', finitura: 'nessuna', qty: 500, vatIncluded: true }).breakdown.resin).toBeGreaterThan(0);
	});

	it('al browser non arrivano fatturato e spese, e il prezzo resta lo stesso anche con le spese attive', () => {
		const L = listinoIniziale();
		L.comune.spese.forEach((s) => (s.on = true));
		const pub = listinoPubblico(L, 'adesivi_personalizzati');
		expect(pub.comune.fatturato).toBe(0);
		expect(pub.comune.spese).toEqual([]);
		expect(pub.prodotti.map((p) => p.id)).toEqual(['adesivi_personalizzati']);
		const p = L.prodotti[0];
		for (const q of [15, 100, 1000]) expect(prezzo(pub, pub.prodotti[0], { mat: 'oro', fin: 'lucida', w: 70, h: 30, q }).lordo).toBe(prezzo(L, p, { mat: 'oro', fin: 'lucida', w: 70, h: 30, q }).lordo);
	});

	it('senza listino agganciato resta la regola vecchia (riserva)', () => {
		const r = quoteWith(DEFAULT_ENGINES.adesivi_personalizzati, { w: 40, h: 40, forma: 'sagomato', materiale: 'bianco', finitura: 'nessuna', qty: 100, vatIncluded: true });
		expect(r.breakdown.k).toBeUndefined();
	});

	it('prezzo "a partire da" e controlli del listino', () => {
		const L = listinoIniziale();
		for (const p of PRODUCT_ENGINES) expect(lowestPrice(attacca(p.slug, L))).toBeGreaterThan(0);
		expect(problemaListino(L)).toBeNull();
		const rotto = listinoIniziale(); rotto.comune.ricarico = 0;
		expect(problemaListino(rotto)).toMatch(/ricarico/i);
		expect(normalizzaListino({ comune: {} })).toBeNull();
		const parziale = normalizzaListino({ ...listinoIniziale(), prodotti: listinoIniziale().prodotti.slice(0, 2) })!;
		expect(parziale.prodotti.length).toBe(6);
	});
});
