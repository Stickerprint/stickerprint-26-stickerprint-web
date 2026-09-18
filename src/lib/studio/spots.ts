/**
 * Tinte piatte di taglio lette dalla Roland (VersaWorks), prese dai file di produzione dell'azienda.
 *   Passante   — taglio passante (fustellato), verde C67 M0 Y88 K0
 *   CutContour — mezzo taglio, fucsia C2 M93 Y0 K0
 * Il nome deve restare ESATTAMENTE questo: e' quello che la macchina riconosce.
 */
export type CutSpot = 'Passante' | 'CutContour';

export const SPOTS: Record<CutSpot, { cmyk: [number, number, number, number]; rgb: string }> = {
	Passante: { cmyk: [0.67, 0, 0.88, 0], rgb: '#4fbf4a' },
	CutContour: { cmyk: [0.02, 0.93, 0, 0], rgb: '#ec008c' }
};
