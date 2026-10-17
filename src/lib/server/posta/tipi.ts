/** Posta in arrivo: tipi condivisi fra webhook, elaborazione e dashboard. */
export interface AllegatoPosta { nome: string; tipo: string; byte: number; path: string }
export type StatoPosta = 'nuova' | 'ordine' | 'preventivo' | 'altro' | 'ignorata' | 'errore';
export interface PostaRiga {
	id: string; message_id: string | null; mail_id: string | null; ricevuta_il: string; data_mail: string | null;
	mittente_email: string; mittente_nome: string | null; destinatari: string[]; oggetto: string | null; testo: string | null; html: string | null;
	allegati: AllegatoPosta[]; stato: StatoPosta; contact_id: string | null; esito: EsitoPosta | null; elaborata_il: string | null; errore: string | null; note: string | null;
}
/** cosa l'assistente ha capito dalla mail */
export type Lavorazione = 'resinata' | 'plastificata' | 'carta_coprente' | 'nessuna';
export interface RigaEstratta { file: string | null; descrizione: string; quantita: number | null; lavorazione: Lavorazione | null; misura_mm: string | null; prezzo_unitario: number | null; note: string | null }
export interface Estratto {
	tipo: 'ordine' | 'preventivo' | 'altro';
	motivo: string;
	cliente: { azienda: string | null; nome: string | null; telefono: string | null };
	righe: RigaEstratta[];
	urgenza: string | null;
	conferma_preventivo: string | null;
}
/** una riga d'ordine pronta: cosa e' stato inserito davvero */
export interface RigaInserita { descrizione: string; codice: string; qty: number; prezzo: number; misura: string | null; file: string | null; mockup: boolean; fonte_misura: 'tracciato' | 'ingombro' | 'regola' | 'mail' | 'nessuna'; note: string | null }
export interface EsitoPosta {
	estratto?: Estratto;
	cliente?: { id: string | null; nome: string; creato: boolean; come: 'email' | 'dominio' | 'nuovo' | 'nessuno' };
	ordine?: { group: string; number: string; righe: RigaInserita[] };
	richiesta?: { id: string };
	blocchi: string[];
	modello?: string;
}
