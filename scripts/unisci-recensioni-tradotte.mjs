/** Unisce traduzioni-recensioni.json (id → {en,es,fr,de,nl → {title?,comment}}) in contenuti.json con l'impronta dell'italiano. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const [,, recensioniPath, traduzioniPath] = process.argv;
const FILE = 'src/lib/contenuti-tradotti/contenuti.json';
const impronta = (c) => createHash('sha1').update(JSON.stringify(c)).digest('hex').slice(0, 16);
const rows = JSON.parse(readFileSync(recensioniPath, 'utf8'));
const tr = JSON.parse(readFileSync(traduzioniPath, 'utf8'));
const file = JSON.parse(readFileSync(FILE, 'utf8')); file.reviews ??= {};
let n = 0;
for (const x of rows) {
	const t = tr[x.id]; if (!t) continue;
	const italiano = { ...(x.title ? { title: x.title } : {}), comment: x.comment };
	const voci = {};
	for (const l of ['en', 'es', 'fr', 'de', 'nl']) { if (!t[l]?.comment) { console.warn('manca', l, x.id); continue; } voci[l] = { ...(x.title && t[l].title ? { title: t[l].title } : {}), comment: t[l].comment }; }
	file.reviews[x.id] = { _hash: impronta(italiano), ...voci }; n++;
}
writeFileSync(FILE, JSON.stringify(file, null, '\t') + '\n');
console.log('recensioni unite:', n, 'totale nel file:', Object.keys(file.reviews).length);
