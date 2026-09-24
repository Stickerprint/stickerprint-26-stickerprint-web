import { error, fail } from '@sveltejs/kit';
import { DEPARTMENTS, type Department, type Machine, type Phase } from '$lib/production/types';
import { bobine, pianoLaminazione, suiPlotter, type LavoroStampa } from '$lib/production/bobine';
import { isoDay } from '$lib/production/calendar';
import { loadQueue, loadSetup, recalcIfStale, startPhase, taskActions, operatorName, type QueueRow } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** quale macchina fa cosa: la UV, quella dei resinati e quella degli adesivi da plastificare */
function ruoliMacchine(machines: Machine[]) {
	const vive = machines.filter((m) => m.is_active && !m.archived_at).sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
	const uv = vive.find((m) => m.capabilities.includes('stampa_uv')) ?? null;
	const eco = vive.filter((m) => m.capabilities.includes('stampa_ecosolvente'));
	/* con due eco-solvente: la prima ai resinati, la seconda agli adesivi da plastificare */
	return { uv, resinati: eco[0] ?? null, laminati: eco[1] ?? eco[0] ?? null };
}

const mq = (row: QueueRow) =>
	row.group.items.reduce((s, i) => s + ((i.width_mm ?? 0) * (i.height_mm ?? 0) * (i.qty ?? 0)) / 1e6, 0);

/** i lavori che aspettano una lavorazione, pronti per essere raggruppati */
function lavoriDi(queue: QueueRow[], stage: Department, oggi: string): LavoroStampa[] {
	const out: LavoroStampa[] = [];
	for (const row of queue) {
		const fase = row.phases.find((p) => p.stage === stage && !p.passive && ['pronto', 'da_fare', 'in_corso', 'bloccato'].includes(p.status));
		if (!fase) continue;
		const f = row.group.items[0];
		out.push({
			jobId: row.job.id,
			faseId: fase.id,
			numero: row.job.order_number,
			cliente: row.group.customer,
			prodotto: f.product_slug ?? '',
			protezione: row.protection,
			rilievo: (f.product_slug ?? '').includes('rilievo'),
			resinato: (f.product_slug ?? '').includes('resinat'),
			canale: row.group.channel,
			pezzi: row.group.items.reduce((s, i) => s + (i.qty ?? 0), 0),
			mq: Math.round(mq(row) * 100) / 100,
			minuti: fase.minutes ?? 0,
			consegna: row.job.promised_ship_date ?? null,
			inCodaDal: (row.job.paid_at ?? row.job.created_at ?? oggi).slice(0, 10),
			stato: fase.status,
			rischio: row.job.risk_status
		});
	}
	return out;
}

/** Vista reparto: in cima la fase con l'ultimo avvio utile piu' vicino; poi in corso, pronte, bloccate, in arrivo */
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const stage = params.stage as Department;
	if (!DEPARTMENTS[stage]) error(404, 'Reparto non trovato');
	await recalcIfStale(supabase);
	const [setup, queue] = await Promise.all([loadSetup(supabase), loadQueue(supabase)]);
	const items: { row: QueueRow; phase: Phase }[] = [];
	for (const row of queue) for (const phase of row.phases) if (phase.stage === stage && !phase.passive && phase.status !== 'completato' && phase.status !== 'saltata') items.push({ row, phase });
	const byLatest = (a: { phase: Phase }, b: { phase: Phase }) => (a.phase.latest_start_at ?? '9').localeCompare(b.phase.latest_start_at ?? '9');
	const oggi = isoDay(new Date(), setup.calendar.timezone);

	/* STAMPA: i compiti del giorno, divisi sulle tre macchine e raggruppati per plastifica */
	const stampa = stage === 'stampa'
		? { macchine: ruoliMacchine(setup.machines), gruppi: bobine(lavoriDi(queue, 'stampa', oggi), oggi, setup.calendar) }
		: null;

	/* LAMINAZIONE: una macchina sola, i lavori in fila per pellicola (un cambio bobina per volta) */
	const laminazione = stage === 'laminazione' ? pianoLaminazione(lavoriDi(queue, 'laminazione', oggi), oggi, setup.calendar) : null;

	/* TAGLIO: i lavori divisi sui due plotter, carico in pari */
	const taglio = stage === 'taglio'
		? suiPlotter(lavoriDi(queue, 'taglio', oggi).sort((a, b) => (a.consegna ?? '9').localeCompare(b.consegna ?? '9')), 2)
		: null;

	/* RESINATURA: una macchina sola, i lavori in ordine di consegna */
	const resinatura = stage === 'resinatura' ? lavoriDi(queue, 'resinatura', oggi).sort((a, b) => (a.consegna ?? '9').localeCompare(b.consegna ?? '9')) : null;

	return {
		stage, info: DEPARTMENTS[stage], setup, now: new Date().toISOString(), oggi, stampa, laminazione, taglio, resinatura,
		running: items.filter((x) => x.phase.status === 'in_corso').sort(byLatest),
		ready: items.filter((x) => x.phase.status === 'pronto').sort(byLatest),
		blocked: items.filter((x) => x.phase.status === 'bloccato').sort(byLatest),
		incoming: items.filter((x) => x.phase.status === 'da_fare').sort(byLatest).slice(0, 12),
		waiting: queue.flatMap((row) => row.phases.filter((p) => p.stage === stage && p.passive && p.status === 'in_attesa').map((phase) => ({ row, phase })))
	};
};

export const actions: Actions = {
	...taskActions,
	/** avvia tutte le stampe di una bobina: una stampata sola per tutti quei lavori */
	bobina: async ({ request, locals }) => {
		const f = await request.formData();
		const ids = String(f.get('fasi') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
		if (!ids.length) return fail(400, { error: 'Nessuna stampa da avviare.' });
		const op = await operatorName(locals.supabase, locals.user);
		const errs: string[] = [];
		for (const id of ids) { const e = await startPhase(locals.supabase, id, op); if (e) errs.push(e); }
		if (errs.length === ids.length) return fail(400, { error: errs[0] });
		return { ok: true, avviate: ids.length - errs.length };
	}
};
