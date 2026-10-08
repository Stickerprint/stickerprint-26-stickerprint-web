-- Area Marketing interna (8/10/2026): al posto della dashboard PERIZ.
-- Tre tabelle: impostazioni (obiettivi e budget), storico giornaliero delle campagne, report con i consigli.

create table if not exists public.marketing_impostazioni (
  id            int primary key default 1 check (id = 1),
  budget_mese   numeric(10,2),                 -- tetto mensile per tutta la pubblicità (null = nessun tetto)
  quote         jsonb not null default '{}',   -- quota decisa per canale, es. {"meta": 600, "google": 400, "tiktok": 0}
  valore_ordine numeric(10,2) not null default 45,   -- valore medio di un ordine: stima il ritorno dove il canale non lo misura
  roas_target   numeric(6,2) not null default 3,     -- ritorno minimo accettabile (€ incassati per € speso)
  cpa_target    numeric(10,2),                 -- costo massimo per ordine (null = valore_ordine / roas_target)
  note          text,
  updated_at    timestamptz not null default now()
);
insert into public.marketing_impostazioni (id) values (1) on conflict do nothing;

create table if not exists public.ads_giorni (
  canale       text not null check (canale in ('meta','google','tiktok')),
  campagna_id  text not null,
  giorno       date not null,
  nome         text not null default '',
  stato        text not null default '',
  spesa        numeric(12,2) not null default 0,
  impressioni  bigint not null default 0,
  clic         bigint not null default 0,
  conversioni  numeric(12,2) not null default 0,
  valore       numeric(12,2),
  primary key (canale, campagna_id, giorno)
);
create index if not exists ads_giorni_giorno on public.ads_giorni (giorno desc);

create table if not exists public.marketing_report (
  id           uuid primary key default gen_random_uuid(),
  canale       text not null check (canale in ('tutti','meta','google','tiktok')),
  periodo_da   date not null,
  periodo_a    date not null,
  dati         jsonb not null default '{}',   -- numeri letti al momento del report
  analisi      jsonb not null default '{}',   -- verdetti e budget calcolati dalle regole
  testo        text,                          -- consigli scritti dall'assistente (null se la chiave non c'è)
  modello      text,
  generato_il  timestamptz not null default now()
);
create index if not exists marketing_report_canale on public.marketing_report (canale, generato_il desc);

alter table public.marketing_impostazioni enable row level security;
alter table public.ads_giorni enable row level security;
alter table public.marketing_report enable row level security;

drop policy if exists "marketing impostazioni: staff legge" on public.marketing_impostazioni;
create policy "marketing impostazioni: staff legge" on public.marketing_impostazioni for select using (public.is_staff());
drop policy if exists "marketing impostazioni: admin scrive" on public.marketing_impostazioni;
create policy "marketing impostazioni: admin scrive" on public.marketing_impostazioni for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ads giorni: staff legge" on public.ads_giorni;
create policy "ads giorni: staff legge" on public.ads_giorni for select using (public.is_staff());
drop policy if exists "ads giorni: staff scrive" on public.ads_giorni;
create policy "ads giorni: staff scrive" on public.ads_giorni for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "marketing report: staff legge" on public.marketing_report;
create policy "marketing report: staff legge" on public.marketing_report for select using (public.is_staff());
drop policy if exists "marketing report: staff scrive" on public.marketing_report;
create policy "marketing report: staff scrive" on public.marketing_report for all using (public.is_staff()) with check (public.is_staff());
