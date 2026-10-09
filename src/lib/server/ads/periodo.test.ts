import { describe, expect, it } from 'vitest';
import { mesiDi } from './periodo';

describe('mesiDi', () => {
	it('anno in corso: da gennaio a oggi, l\'ultimo mese tagliato', () => {
		const m = mesiDi({ da: '2026-01-01', a: '2026-10-09' });
		expect(m).toHaveLength(10);
		expect(m[0]).toEqual({ da: '2026-01-01', a: '2026-01-31' });
		expect(m[1]).toEqual({ da: '2026-02-01', a: '2026-02-28' });
		expect(m[9]).toEqual({ da: '2026-10-01', a: '2026-10-09' });
	});
	it('anno bisestile e cambio d\'anno', () => {
		expect(mesiDi({ da: '2028-02-10', a: '2028-02-29' })).toEqual([{ da: '2028-02-10', a: '2028-02-29' }]);
		expect(mesiDi({ da: '2025-12-15', a: '2026-01-05' })).toEqual([{ da: '2025-12-15', a: '2025-12-31' }, { da: '2026-01-01', a: '2026-01-05' }]);
	});
});
