/**
 * Solo per i test: Postgres embedded (pglite) con le migrazioni VERE del progetto e un client minimo
 * che imita la parte di supabase-js usata dal modulo di produzione (select/insert/update/upsert/delete + filtri).
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = path.resolve(process.cwd(), 'supabase/migrations');
const PRE = `
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions;
create table auth.users (id uuid primary key, email text, created_at timestamptz, updated_at timestamptz, raw_user_meta_data jsonb, raw_app_meta_data jsonb, encrypted_password text, email_confirmed_at timestamptz, instance_id uuid, aud text, role text, is_sso_user bool default false, is_anonymous bool default false);
create table auth.identities (id uuid primary key, user_id uuid, provider text, provider_id text, identity_data jsonb, created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz);
create table storage.buckets (id text primary key, name text, public bool default false, owner uuid, created_at timestamptz, updated_at timestamptz, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz, updated_at timestamptz, last_accessed_at timestamptz, metadata jsonb, path_tokens text[]);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create function storage.filename(name text) returns text language sql immutable as $$ select name $$;
create function storage.extension(name text) returns text language sql immutable as $$ select name $$;
create table public._test_ctx (uid uuid);
insert into public._test_ctx values (null);
create function auth.uid() returns uuid language sql stable as $$ select uid from public._test_ctx limit 1 $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
`;
function split(sql: string): string[] {
	const out: string[] = []; let cur = ''; let dollar: string | null = null; let i = 0;
	while (i < sql.length) {
		const ch = sql[i];
		if (!dollar && ch === '-' && sql[i + 1] === '-') { const j = sql.indexOf('\n', i); i = j < 0 ? sql.length : j; continue; }
		const m = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
		if (m) { if (!dollar) dollar = m[0]; else if (dollar === m[0]) dollar = null; cur += m[0]; i += m[0].length; continue; }
		if (!dollar && ch === ';') { out.push(cur.trim()); cur = ''; i++; continue; }
		cur += ch; i++;
	}
	if (cur.trim()) out.push(cur.trim());
	return out.filter(Boolean);
}
export async function freshDb(): Promise<PGlite> {
	// come supabase-js: date e timestamp arrivano come stringhe, non come Date
	const db = new PGlite({ parsers: { 1082: (v: string) => v, 1114: (v: string) => new Date(v + 'Z').toISOString(), 1184: (v: string) => new Date(v).toISOString(), 1700: (v: string) => Number(v) } });
	await db.exec(PRE);
	const bad: string[] = [];
	for (const f of fs.readdirSync(MIG).sort()) for (const st of split(fs.readFileSync(path.join(MIG, f), 'utf8'))) {
		try { await db.exec(st); } catch (e) {
			// policy, estensioni, cron, grant, viste su schemi di Supabase: non servono ai test. Tutto il resto deve passare.
			if (/^(create|drop|alter) (policy|extension)|cron\.|grant |revoke |storage\.|auth\.|realtime|pg_net|supabase_functions|create publication|alter publication/i.test(st) || /schema "(cron|extensions|net)"/.test(String(e))) continue;
			bad.push(`${f}: ${String((e as Error).message).split('\n')[0].slice(0, 120)} :: ${st.slice(0, 80).replace(/\s+/g, ' ')}`);
		}
	}
	if (bad.length) throw new Error('Migrazioni con errori:\n' + bad.join('\n'));
	return db;
}

/* ---------- valori SQL ---------- */
const lit = (v: unknown): string => {
	if (v === null || v === undefined) return 'null';
	if (typeof v === 'number') return String(v);
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (v instanceof Date) return `'${v.toISOString()}'`;
	if (Array.isArray(v)) return v.length ? `ARRAY[${v.map(lit).join(',')}]` : `'{}'`;
	if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
	return `'${String(v).replace(/'/g, "''")}'`;
};
const q = (c: string) => `"${c}"`;

/** query builder minimo, compatibile con l'uso che ne fa src/lib/server/produzione.ts */
class Q implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count: number | null }> {
	private where: string[] = []; private orderBy: string[] = []; private lim: number | null = null; private one: 'single' | 'maybe' | null = null;
	private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'; private cols = '*'; private payload: unknown = null; private countMode = false; private headOnly = false; private conflict = ''; private ignoreDup = false; private returning = false;
	constructor(private db: PGlite, private table: string) {}
	select(cols = '*', opts: { count?: string; head?: boolean } = {}) { if (this.mode === 'select') { this.cols = cols; if (opts.count) this.countMode = true; if (opts.head) this.headOnly = true; } else this.returning = true; return this; }
	insert(p: unknown) { this.mode = 'insert'; this.payload = p; return this; }
	upsert(p: unknown, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.mode = 'upsert'; this.payload = p; this.conflict = o.onConflict ?? ''; this.ignoreDup = !!o.ignoreDuplicates; return this; }
	update(p: unknown) { this.mode = 'update'; this.payload = p; return this; }
	delete() { this.mode = 'delete'; return this; }
	eq(c: string, v: unknown) { this.where.push(`${q(c)} = ${lit(v)}`); return this; }
	neq(c: string, v: unknown) { this.where.push(`${q(c)} <> ${lit(v)}`); return this; }
	in(c: string, v: unknown[]) { this.where.push(v.length ? `${q(c)} in (${v.map(lit).join(',')})` : 'false'); return this; }
	is(c: string, v: unknown) { this.where.push(`${q(c)} is ${v === null ? 'null' : lit(v)}`); return this; }
	not(c: string, op: string, v: unknown) { this.where.push(`not (${q(c)} ${op} ${v === null ? 'null' : lit(v)})`); return this; }
	gte(c: string, v: unknown) { this.where.push(`${q(c)} >= ${lit(v)}`); return this; }
	gt(c: string, v: unknown) { this.where.push(`${q(c)} > ${lit(v)}`); return this; }
	lte(c: string, v: unknown) { this.where.push(`${q(c)} <= ${lit(v)}`); return this; }
	lt(c: string, v: unknown) { this.where.push(`${q(c)} < ${lit(v)}`); return this; }
	order(c: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) { this.orderBy.push(`${q(c)} ${o.ascending === false ? 'desc' : 'asc'}${o.nullsFirst === false ? ' nulls last' : ''}`); return this; }
	limit(n: number) { this.lim = n; return this; }
	maybeSingle() { this.one = 'maybe'; return this; }
	single() { this.one = 'single'; return this; }
	private sql(): string {
		const w = this.where.length ? ` where ${this.where.join(' and ')}` : '';
		const cols = this.cols === '*' ? '*' : this.cols.split(',').map((c) => c.trim()).filter((c) => !c.includes('(')).map(q).join(', ');
		if (this.mode === 'select') { if (this.countMode) return `select count(*)::int as n from public.${this.table}${w}`; return `select ${cols} from public.${this.table}${w}${this.orderBy.length ? ' order by ' + this.orderBy.join(', ') : ''}${this.lim ? ' limit ' + this.lim : ''}`; }
		if (this.mode === 'delete') return `delete from public.${this.table}${w} returning *`;
		if (this.mode === 'update') { const p = this.payload as Record<string, unknown>; const set = Object.entries(p).filter(([, v]) => v !== undefined).map(([k, v]) => `${q(k)} = ${lit(v)}`).join(', '); return `update public.${this.table} set ${set}${w} returning *`; }
		const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Record<string, unknown>[];
		const keys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))];
		const vals = rows.map((r) => `(${keys.map((k) => lit(r[k])).join(', ')})`).join(', ');
		let s = `insert into public.${this.table} (${keys.map(q).join(', ')}) values ${vals}`;
		if (this.mode === 'upsert' && this.conflict) s += this.ignoreDup ? ` on conflict (${this.conflict.split(',').map((c) => q(c.trim())).join(',')}) do nothing` : ` on conflict (${this.conflict.split(',').map((c) => q(c.trim())).join(',')}) do update set ${keys.filter((k) => !this.conflict.split(',').map((c) => c.trim()).includes(k)).map((k) => `${q(k)} = excluded.${q(k)}`).join(', ')}`;
		return s + ' returning *';
	}
	async exec() {
		try {
			const r = await this.db.query<Record<string, unknown>>(this.sql());
			if (this.countMode) return { data: null, error: null, count: Number(r.rows[0]?.n ?? 0) };
			let data: unknown = r.rows;
			if (this.one) { data = r.rows[0] ?? null; if (this.one === 'single' && !data) return { data: null, error: { message: 'no rows', code: 'PGRST116' }, count: null }; }
			if (this.headOnly) data = null;
			return { data, error: null, count: null };
		} catch (e) {
			const msg = String((e as Error).message ?? e);
			return { data: null, error: { message: msg, code: /duplicate key/.test(msg) ? '23505' : undefined }, count: null };
		}
	}
	then<A, B>(ok: (v: { data: unknown; error: { message: string; code?: string } | null; count: number | null }) => A | PromiseLike<A>, ko?: (e: unknown) => B | PromiseLike<B>) { return this.exec().then(ok, ko); }
}
/** finto SupabaseClient: solo `.from()`; `auth.uid()` si imposta con setUser */
export function fakeClient(db: PGlite) {
	const client = { from: (t: string) => new Q(db, t) };
	return client as unknown as import('@supabase/supabase-js').SupabaseClient;
}
export async function setUser(db: PGlite, uid: string | null) { await db.query(`update public._test_ctx set uid = ${uid ? `'${uid}'` : 'null'}`); }
