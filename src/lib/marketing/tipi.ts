/**
 * Le forme delle risposte della dashboard PERIZ (api/partner.js,
 * api/social-insights.js, api/campaign-insights.js). Quando un numero non è
 * arrivato è `null`, non zero: le pagine scrivono un trattino e il motivo.
 */

export type Piattaforma = 'instagram' | 'tiktok' | 'facebook';

export type StatoContenuto =
	| 'in_attesa'
	| 'modifiche_richieste'
	| 'approvato'
	| 'programmato'
	| 'in_pubblicazione'
	| 'pubblicato';

export interface Contenuto {
	id: string;
	brand_id: string;
	title: string;
	content_type: string | null;
	platforms: Piattaforma[] | null;
	version: number | null;
	file_url: string | null;
	/** URL firmato per un'ora dal server della dashboard (il bucket è privato). */
	url: string | null;
	media: 'video' | 'immagine' | 'pdf' | 'altro' | 'nessuno';
	message_to_client: string | null;
	respond_by: string | null;
	status: StatoContenuto;
	sent_at: string | null;
	caption: string | null;
	publish_date: string | null;
	publish_time: string | null;
	publish_error: string | null;
	published_at?: string | null;
	suggested_budget: number | null;
	budget_ads: number | null;
	budget_split: Partial<Record<Piattaforma, number>> | null;
	campaign_objective: string | null;
}

export interface Commento {
	id: string;
	approval_id: string;
	author_role: 'client' | 'admin';
	message: string;
	version: number | null;
	created_at: string;
}

export interface Conteggi {
	totale: number;
	in_attesa: number;
	modifiche_richieste: number;
	approvato: number;
	programmato: number;
	in_pubblicazione: number;
	pubblicato: number;
	errori: number;
	senzaBudget: number;
	budgetAssegnato: number;
}

export interface RispostaContenuti {
	contenuti: Contenuto[];
	commenti: Commento[];
	conteggi: Conteggi;
}

export interface Attivita {
	id: string;
	title: string;
	type: 'pubblicazione' | 'riprese' | 'montaggio' | 'analisi' | 'scadenza' | 'altro';
	date: string;
	time: string | null;
	status: 'da_fare' | 'programmato' | 'in_revisione' | 'completato';
	notes: string | null;
	channels?: Piattaforma[] | null;
	description?: string | null;
}
export interface RispostaAttivita {
	attivita: Attivita[];
}

export interface RichiestaAppuntamento {
	id: string;
	type: string;
	preferred_date: string | null;
	time_slot: string | null;
	notes: string | null;
	status: 'in_attesa' | 'confermata' | 'rifiutata';
	created_at: string;
}
export interface RispostaAppuntamenti {
	appuntamenti: Attivita[];
	richieste: RichiestaAppuntamento[];
	avviso: string | null;
	etichette: { tipi: Record<string, string>; fasce: Record<string, string> };
}

export interface SpesaCanale {
	valore: number | null;
	fonte: 'meta' | 'manuale' | null;
	motivo?: string;
	aggiornato?: string;
	nota?: string;
}
export interface Budget {
	totale: number | null;
	canali: Record<'meta' | 'google' | 'tiktok', number | null>;
	mese: string;
	primoGiornoMese: string;
	oggi: string;
	manuale: Record<string, { valore: number | null; nota: string; aggiornato: string }>;
	avviso: string | null;
	spesa?: Record<string, SpesaCanale>;
}
export interface QuotaBudget {
	platform: string;
	monthly_budget: number;
}
export interface Movimento {
	id: string;
	kind: string;
	title: string;
	detail: string | null;
	created_at: string;
}
export interface RispostaBudget {
	budget: Budget;
	quote: QuotaBudget[];
	movimenti: Movimento[];
	etichette: { obiettivi: Record<string, string> };
}

export interface Notifica {
	id: string;
	evento: string;
	titolo: string;
	testo: string | null;
	link: string | null;
	letta_at: string | null;
	whatsapp_stato: string | null;
	whatsapp_errore: string | null;
	created_at: string;
}
export interface RispostaNotifiche {
	notifiche: Notifica[];
	nonLette: number;
	whatsapp: { numero: string; attivo: boolean; nome: string } | null;
	avviso?: string | null;
}

export interface Report {
	id: string;
	name: string;
	kind: string;
	period_from: string | null;
	period_to: string | null;
	platforms: string[];
	sections: string[];
	status: string;
	created_at: string;
}
export interface RispostaReport {
	report: Report[];
	avviso: string | null;
	etichette: { tipi: Record<string, string> };
}

export interface RispostaBrand {
	brand: { id: string; slug: string; name: string; platforms: string[] | null };
	meta: {
		collegato: boolean;
		connected_at: string | null;
		expires_at: string | null;
		last_error: string | null;
		pagina: boolean;
		instagram: boolean;
		accountPubblicitario: boolean;
	};
}

/* ------------------------------------------------------------ Meta */
export interface PuntoGiorno {
	giorno?: string;
	label: string;
	instagram?: number;
	facebook?: number;
	value?: number;
}
export interface ContenutoTop {
	id: string;
	url?: string | null;
	permalink?: string | null;
	anteprima?: string | null;
	didascalia?: string | null;
	tipo?: string | null;
	data?: string | null;
	like: number;
	commenti: number;
	copertura?: number | null;
}
export interface SocialCollegato {
	ok: true;
	collegato: true;
	aggiornato: string;
	periodo: { da: string; a: string; giorni: number };
	kpi: {
		copertura: number | null;
		interazioni: number | null;
		follower: number | null;
		nuoviFollower: number | null;
		variazioneCopertura: number | null;
	};
	trend: PuntoGiorno[];
	serieGiorni: PuntoGiorno[];
	canali: { nome: string; valore: number; pct: number; colore: string }[];
	serieFollower: PuntoGiorno[];
	engagement: { name: string; value: number; color: string }[];
	contenuti: ContenutoTop[];
	instagram: { collegato: boolean; username: string | null };
	facebook: { collegato: boolean; nome: string | null };
	tiktok: { collegato: false; motivo: string };
	avvisi: string[];
}
export interface NonCollegato {
	ok: true;
	collegato: false;
	motivo: string;
	avvisi?: string[];
}
export type RispostaSocial = SocialCollegato | NonCollegato;

export interface Campagna {
	id: string;
	nome: string;
	stato: string;
	statoEtichetta: string;
	budget: number | null;
	budgetTipo: 'giornaliero' | 'totale' | null;
	attiva: boolean;
	spesa: number;
	lead: number;
	costoPerLead: number | null;
}
export interface CampagneCollegate {
	ok: true;
	collegato: true;
	aggiornato: string;
	accountPubblicitario: string;
	budgetMensile: number | null;
	budget: Budget;
	kpi: {
		budgetMensile: number | null;
		spesa: number | null;
		lead: number | null;
		costoPerLead: number | null;
		impressioni: number | null;
		clic: number | null;
	};
	serie: { label: string; spesa: number; lead: number }[];
	campagne: Campagna[];
	tiktok: { collegato: false; motivo: string };
	avvisi: string[];
}
export type RispostaCampagne = CampagneCollegate | (NonCollegato & { budget?: Budget });
