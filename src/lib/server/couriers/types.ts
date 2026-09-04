/** Interfaccia comune degli adattatori corriere (GLS, FedEx, TNT). */
export interface ShipmentInput {
	orderNumber: string; group: string; reference: string;
	recipient: { name: string; contact?: string; street: string; zip: string; city: string; province: string; country: string; phone?: string; email?: string };
	parcels: number; weightKg: number; contents: string; notes?: string;
}
export interface ShipmentResult { tracking: string; labelPdf: Uint8Array | null; raw?: unknown }
export interface CloseDayResult { manifestPdf: Uint8Array | null; raw?: unknown }
export interface CourierAdapter {
	id: string;
	/** true quando tutte le credenziali sono presenti nelle variabili d'ambiente */
	configured: boolean;
	/** variabili d'ambiente mancanti */
	missing: string[];
	/** crea la spedizione presso il corriere: numero di tracking e, se disponibile, l'etichetta PDF ufficiale */
	createShipment(s: ShipmentInput): Promise<ShipmentResult>;
	/** chiude la giornata / trasmette le spedizioni e restituisce il manifest ufficiale se il corriere lo fornisce */
	closeDay(shipments: { tracking: string; orderNumber: string }[]): Promise<CloseDayResult>;
}
export const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0));
export const xmlEsc = (s: string | undefined | null) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const xmlTag = (xml: string, tag: string) => { const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1].trim() : ''; };
