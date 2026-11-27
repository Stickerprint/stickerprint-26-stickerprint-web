/**
 * Base di bianco (Mattia, 27/11/2026): sui materiali speciali il cliente puo' chiedere il bianco RDG_WHITE
 * sotto la grafica. Il disegno esce acceso come su vinile bianco e il materiale resta solo come sfondo.
 * Non vale per le vetrofanie (il bianco ce l'hanno sempre). Il prezzo per ora non cambia.
 */
export const MATERIALI_BASE_BIANCO = ['olografico', 'glitterato', 'trasparente', 'argento', 'oro'] as const;

/** il materiale offre la base di bianco su questo prodotto */
export const offreBaseBianco = (materiale: string | null | undefined, prodotto?: string | null) =>
	!!materiale && prodotto !== 'vetrofanie' && (MATERIALI_BASE_BIANCO as readonly string[]).includes(materiale);

/** la base di bianco chiesta per una riga d'ordine: sta nelle regolazioni del motore salvate col carrello */
export const rigaConBaseBianco = (materiale: string | null | undefined, prodotto: string | null | undefined, engineState: unknown) =>
	offreBaseBianco(materiale, prodotto) && !!(engineState && typeof engineState === 'object' && (engineState as { baseBianco?: unknown }).baseBianco);
