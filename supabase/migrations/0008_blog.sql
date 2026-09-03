-- Blog: articoli con categoria, copertina e contenuto HTML (foto/video inclusi), gestiti dalla dashboard.
create table if not exists public.post_categories (
  name text primary key,
  sort int not null default 0
);
insert into public.post_categories (name, sort) values ('News', 1), ('Consigli', 2), ('Idee', 3) on conflict (name) do nothing;

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text,
  category     text not null default 'News' references public.post_categories(name) on update cascade,
  cover_url    text,
  content      text not null default '',
  author       text not null default 'Admin',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();

alter table public.post_categories enable row level security;
alter table public.posts enable row level security;
drop policy if exists "categories: public read" on public.post_categories;
create policy "categories: public read" on public.post_categories for select using (true);
drop policy if exists "categories: staff all" on public.post_categories;
create policy "categories: staff all" on public.post_categories for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "posts: public read" on public.posts;
create policy "posts: public read" on public.posts for select using (published = true or public.is_staff());
drop policy if exists "posts: staff all" on public.posts;
create policy "posts: staff all" on public.posts for all using (public.is_staff()) with check (public.is_staff());

-- Foto e video degli articoli
insert into storage.buckets (id, name, public) values ('blog-media', 'blog-media', true) on conflict (id) do nothing;
drop policy if exists "blog media: public read" on storage.objects;
create policy "blog media: public read" on storage.objects for select using (bucket_id = 'blog-media');
drop policy if exists "blog media: staff write" on storage.objects;
create policy "blog media: staff write" on storage.objects for insert with check (bucket_id = 'blog-media' and public.is_staff());
drop policy if exists "blog media: staff update" on storage.objects;
create policy "blog media: staff update" on storage.objects for update using (bucket_id = 'blog-media' and public.is_staff());
drop policy if exists "blog media: staff delete" on storage.objects;
create policy "blog media: staff delete" on storage.objects for delete using (bucket_id = 'blog-media' and public.is_staff());

-- Articoli ripresi dal blog attuale
insert into public.posts (slug, title, excerpt, category, cover_url, content, published, published_at) values
('nuova-collaborazione-sephora-x-stickerprint', 'Nuova Collaborazione Sephora X Stickerprint',
 'Per la campagna Natale 2025 abbiamo realizzato per Sephora esclusivi fogli di adesivi resinati.', 'News', '/images/blog/sephora.jpg',
 $html$<p>Siamo felici di annunciare una nuova collaborazione che profuma di stile e innovazione ✨</p>
<p>Per la campagna Natale 2025, abbiamo realizzato per Sephora esclusivi fogli di adesivi resinati, pensati per valorizzare il brand con un finish premium, resistente e ad alto impatto visivo.</p>
<p>Un progetto che unisce design, qualità e cura del dettaglio, dove la resinatura dona profondità, brillantezza e una sensazione tattile che fa la differenza. Esattamente il tipo di risultato che amiamo ottenere quando lavoriamo al fianco di grandi marchi.</p>
<p>Questa collaborazione conferma il nostro impegno nel supportare le aziende con adesivi personalizzati su misura, capaci di rafforzare campagne marketing e comunicazione visiva.</p>
<p>👉 Hai un brand e vuoi realizzare adesivi professionali per la tua prossima campagna? Scopri tutte le nostre soluzioni dedicate nella <a href="/aziende">pagina Aziende</a>. 💪🏻</p>$html$,
 true, '2025-11-26 10:00+01'),
('benvenuti-nel-nuovo-stickerprint', '✨ Benvenuti nel nuovo Stickerprint',
 'Ci siamo (ri)fatti il look 😎', 'News', '/images/blog/nuovo-sito.jpg',
 $html$<p>Dopo mesi di duro lavoro, siamo felici di annunciare il nostro nuovo sito, completamente rinnovato — nel look, nelle funzionalità e nell’esperienza d’acquisto.</p>
<p>Un restyling nato per semplificare ogni passaggio, rendere tutto più chiaro, più veloce e soprattutto… più vicino a te.</p>
<h2>🚀 Più prodotti, più scelta</h2>
<p>Abbiamo ampliato il nostro catalogo con nuovi formati, materiali e finiture, per offrirti ancora più libertà nella creazione dei tuoi adesivi e delle tue etichette personalizzate. Che tu sia un privato, un designer o un’azienda, troverai sempre la soluzione perfetta per il tuo progetto.</p>
<h2>💸 Prezzi più convenienti (e trasparenti)</h2>
<p>Abbiamo rivisto il nostro sistema di pricing per renderlo più chiaro, più competitivo e senza sorprese. Gli sconti per quantità vengono applicati in automatico, così puoi vedere subito quanto risparmi. E grazie alla nuova anteprima gratuita di stampa, pagherai solo dopo aver approvato il tuo design. Zero rischi, solo risultati perfetti.</p>
<h2>🧩 La nuova area personale: tutto sotto controllo</h2>
<p>Una delle novità di cui siamo più orgogliosi è la nuova area personale, completamente riprogettata per darti il massimo controllo in modo semplice e intuitivo. Da qui puoi:</p>
<ul><li>monitorare lo stato dei tuoi ordini in tempo reale</li><li>tracciare le spedizioni passo dopo passo</li><li>riordinare con un clic qualsiasi prodotto già stampato</li><li>salvare i tuoi dati di fatturazione, spedizione e pagamento per rendere ogni acquisto ancora più veloce</li><li>e tante altre funzionalità che verranno implementate presto</li></ul>
<p>Tutto pensato per farti risparmiare tempo e semplificare ogni processo.</p>
<h2>🎨 Prove di stampa gratuite, sempre</h2>
<p>Prima di pagare, vedrai sempre l’anteprima della tua grafica pronta per la stampa. Solo dopo la tua conferma procederemo con la produzione — perché la trasparenza e la qualità sono alla base del nostro modo di lavorare.</p>
<h2>💬 Il nuovo Stickerprint: più semplice, più veloce, più tuo</h2>
<p>Questo restyling non è solo una questione estetica: è il nostro modo per offrirti un’esperienza più moderna, chiara e personalizzata. Dalla scelta del materiale alla consegna, tutto è stato ottimizzato per permetterti di creare, ordinare e ricevere adesivi perfetti… in pochi clic.</p>$html$,
 true, '2025-11-23 10:00+01')
on conflict (slug) do nothing;
