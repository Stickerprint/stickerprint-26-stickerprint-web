import { loadCustomers } from '$lib/server/customers';
import { buildXlsx } from '$lib/server/xlsx';
import type { RequestHandler } from './$types';

/** Excel dei clienti filtrati (per importarli in Klaviyo) */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const type = url.searchParams.get('type') ?? 'azienda';
	const level = url.searchParams.get('level') ?? 'all';
	const all = await loadCustomers(supabase);
	const list = all.filter((c) => c.type === type && (level === 'all' || c.level === level));
	const rows: (string | number | null)[][] = [['Email', 'Nome', 'Azienda', 'P.IVA', 'Telefono', 'Tipo', 'Livello', 'Ordini', 'Speso netto', 'Spesa media', 'Ultimo ordine']];
	for (const c of list) rows.push([c.email, c.name, c.company, c.vat, c.phone, c.type, c.levelName, c.orders, Math.round(c.spent * 100) / 100, Math.round(c.avg * 100) / 100, c.lastOrder ? c.lastOrder.slice(0, 10) : null]);
	const file = buildXlsx('Clienti', rows);
	return new Response(new Blob([file as BlobPart]), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="clienti-${type}-${level}.xlsx"` } });
};
