/** Archivio zip minimo (metodo "store", senza compressione) per xlsx e pacchetti di XML. */
function crc32(buf: Uint8Array): number {
	let c: number, crc = 0xffffffff;
	for (let n = 0; n < buf.length; n++) {
		c = (crc ^ buf[n]) & 0xff;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xffffffff) >>> 0;
}
const enc = new TextEncoder();
export function buildZip(files: [string, string | Uint8Array][]): Uint8Array {
	const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
	const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]; const le32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
	for (const [name, content] of files) {
		const nameB = enc.encode(name); const data = typeof content === 'string' ? enc.encode(content) : content; const crc = crc32(data);
		const local = new Uint8Array([...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(nameB.length), ...le16(0), ...nameB]);
		parts.push(local, data);
		central.push(new Uint8Array([...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...nameB]));
		offset += local.length + data.length;
	}
	const cdSize = central.reduce((s, c) => s + c.length, 0);
	const end = new Uint8Array([...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length), ...le32(cdSize), ...le32(offset), ...le16(0)]);
	const out = new Uint8Array(offset + cdSize + end.length); let p = 0;
	for (const b of [...parts, ...central, end]) { out.set(b, p); p += b.length; }
	return out;
}
