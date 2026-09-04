import { gls } from './gls';
import { fedex } from './fedex';
import { tnt } from './tnt';
import type { CourierAdapter } from './types';
export type { CourierAdapter, ShipmentInput, ShipmentResult } from './types';

export const ADAPTERS: Record<string, CourierAdapter> = { GLS: gls, FedEx: fedex, TNT: tnt };
export const adapterFor = (courier: string): CourierAdapter | null => ADAPTERS[courier] ?? null;
/** Stato dei collegamenti per la pagina Setup → Corrieri */
export const courierStatus = () => Object.values(ADAPTERS).map((a) => ({ id: a.id, configured: a.configured, missing: a.missing }));
