import {Buffer} from 'node:buffer';

const u16 = (n: number) => {const b = Buffer.alloc(2); b.writeUInt16BE(n); return b;};
const u32 = (n: number) => {const b = Buffer.alloc(4); b.writeUInt32BE(n); return b;};
const u64 = (n: bigint) => {const b = Buffer.alloc(8); b.writeBigUInt64BE(n); return b;};
const box = (type: string, ...data: Uint8Array[]) => {const bytes = Buffer.concat(data); return Buffer.concat([u32(bytes.length + 8), Buffer.from(type), bytes]);};
const full = (version: number) => Buffer.from([version, 0, 0, 0]);
const nul = (s: string) => Buffer.from(s + '\0');
type Box = {type: string; start: number; header: number; end: number; bytes: Buffer};

function boxes(data: Buffer, start = 0, end = data.length): Box[] {
  const result: Box[] = [];
  while (start < end) {
    if (end - start < 8) throw new Error('Estrutura AVIF incompleta.');
    let size = data.readUInt32BE(start), header = 8;
    if (size === 1) {if (end - start < 16) throw new Error('Estrutura AVIF inválida.'); size = Number(data.readBigUInt64BE(start + 8)); header = 16;}
    if (size === 0) size = end - start;
    if (!Number.isSafeInteger(size) || size < header || start + size > end || result.length > 10000) throw new Error('Estrutura AVIF inválida.');
    result.push({type: data.toString('ascii', start + 4, start + 8), start, header, end: start + size, bytes: data.subarray(start, start + size)});
    start += size;
  }
  return result;
}

function copyrightTiff(copyright: string) {
  const text = Buffer.from(copyright + '\0', 'utf8');
  const tiff = Buffer.alloc(26 + text.length);
  tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x8298, 10); tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(text.length, 14);
  if (text.length <= 4) text.copy(tiff, 18); else {tiff.writeUInt32LE(26, 18); text.copy(tiff, 26);}
  return tiff;
}

function copyrightXmp(copyright: string) {
  const escaped = copyright.replace(/[<>&"']/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]!));
  return Buffer.from(`<?xpacket begin="\uFEFF"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escaped}</rdf:li></rdf:Alt></dc:rights></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`, 'utf8');
}

function webpRights(input: Buffer, copyright: string, width: number, height: number) {
  if (input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WEBP' || input.readUInt32LE(4) + 8 !== input.length) throw new Error('WebP inválido.');
  const chunks: {type: string; data: Buffer}[] = [];
  for (let offset = 12; offset < input.length;) {
    if (offset + 8 > input.length) throw new Error('WebP incompleto.');
    const type = input.toString('ascii', offset, offset + 4), length = input.readUInt32LE(offset + 4);
    if (offset + 8 + length + (length & 1) > input.length) throw new Error('WebP incompleto.');
    chunks.push({type, data: input.subarray(offset + 8, offset + 8 + length)}); offset += 8 + length + (length & 1);
  }
  const chunk = (type: string, data: Buffer) => {const size = Buffer.alloc(4); size.writeUInt32LE(data.length); return Buffer.concat([Buffer.from(type), size, data, ...(data.length & 1 ? [Buffer.alloc(1)] : [])]);};
  const oldHeader = chunks.find(c => c.type === 'VP8X')?.data;
  const header = oldHeader ? Buffer.from(oldHeader) : Buffer.alloc(10);
  if (header.length !== 10 || width < 1 || height < 1 || width > 0x1000000 || height > 0x1000000) throw new Error('Dimensões WebP inválidas.');
  const lossless = chunks.find(c => c.type === 'VP8L')?.data;
  if (chunks.some(c => c.type === 'ALPH') || (lossless && lossless.length > 4 && (lossless[4] & 0x10))) header[0] |= 0x10;
  header[0] |= 0x0c; // EXIF + XMP; original pixel chunks stay byte-for-byte intact.
  header.writeUIntLE(width - 1, 4, 3); header.writeUIntLE(height - 1, 7, 3);
  const payload = Buffer.concat([Buffer.from('WEBP'), chunk('VP8X', header), ...chunks.filter(c => !['VP8X', 'EXIF', 'XMP '].includes(c.type)).map(c => chunk(c.type, c.data)), chunk('EXIF', copyrightTiff(copyright)), chunk('XMP ', copyrightXmp(copyright))]);
  const length = Buffer.alloc(4); length.writeUInt32LE(payload.length);
  return Buffer.concat([Buffer.from('RIFF'), length, payload]);
}

type Location = {id: number; method: number; reference: number; base: bigint; extents: {index: bigint; offset: bigint; length: bigint}[]};
function readLocations(data: Buffer): Location[] {
  let p = 0;
  const read = (size: number): bigint => {if (size > 8 || p + size > data.length) throw new Error('Localização AVIF inválida.'); let n = 0n; for (let i = 0; i < size; i++) n = (n << 8n) | BigInt(data[p++]); return n;};
  const version = Number(read(1)); read(3);
  if (version > 2) throw new Error('Versão AVIF não suportada.');
  const sizes = Number(read(1)), rest = Number(read(1));
  const offsetSize = sizes >> 4, lengthSize = sizes & 15, baseSize = rest >> 4, indexSize = version ? rest & 15 : 0;
  const count = Number(read(version < 2 ? 2 : 4));
  if (count > 10000) throw new Error('AVIF excedeu o limite de itens.');
  const locations: Location[] = [];
  for (let i = 0; i < count; i++) {
    const id = Number(read(version < 2 ? 2 : 4)), method = version ? Number(read(2)) & 15 : 0, reference = Number(read(2)), base = read(baseSize), extentCount = Number(read(2));
    if (extentCount > 10000) throw new Error('AVIF excedeu o limite de extensões.');
    const extents: Location['extents'] = [];
    for (let j = 0; j < extentCount; j++) extents.push({index: indexSize ? read(indexSize) : 0n, offset: read(offsetSize), length: read(lengthSize)});
    locations.push({id, method, reference, base, extents});
  }
  if (p !== data.length) throw new Error('Localização AVIF inconsistente.');
  return locations;
}
function writeLocations(locations: Location[]) {
  return box('iloc', full(2), Buffer.from([0x88, 0x88]), u32(locations.length), ...locations.map(l => Buffer.concat([u32(l.id), u16(l.method), u16(l.reference), u64(l.base), u16(l.extents.length), ...l.extents.map(e => Buffer.concat([u64(e.index), u64(e.offset), u64(e.length)]))])));
}

function avifRights(input: Buffer, copyright: string) {
  const top = boxes(input), meta = top.find(b => b.type === 'meta');
  if (!meta || !top.some(b => b.type === 'ftyp' && /avif|avis/.test(b.bytes.toString('ascii', b.header)))) throw new Error('AVIF inválido.');
  const children = boxes(input, meta.start + meta.header + 4, meta.end);
  const iinf = children.find(b => b.type === 'iinf'), iloc = children.find(b => b.type === 'iloc'), pitm = children.find(b => b.type === 'pitm'), iref = children.find(b => b.type === 'iref');
  if (!iinf || !iloc || !pitm) throw new Error('Índice AVIF incompleto.');
  const primary = input[pitm.start + pitm.header] === 0 ? input.readUInt16BE(pitm.start + pitm.header + 4) : input.readUInt32BE(pitm.start + pitm.header + 4);
  const entries = boxes(input, iinf.start + iinf.header + (input[iinf.start + iinf.header] === 0 ? 6 : 8), iinf.end);
  const locations = readLocations(input.subarray(iloc.start + iloc.header, iloc.end));
  const maxId = Math.max(primary, ...locations.map(l => l.id), ...entries.filter(e => e.type === 'infe').map(e => input[e.start + e.header] === 2 ? input.readUInt16BE(e.start + e.header + 4) : input.readUInt32BE(e.start + e.header + 4)));
  if (maxId > 0xfffffffc) throw new Error('Índice AVIF excedido.');
  const exifId = maxId + 1, xmpId = maxId + 2;
  const exif = Buffer.concat([u32(0), copyrightTiff(copyright)]), xmp = copyrightXmp(copyright);
  const extras: Location[] = [{id: exifId, method: 0, reference: 0, base: 0n, extents: [{index: 0n, offset: 0n, length: BigInt(exif.length)}]}, {id: xmpId, method: 0, reference: 0, base: 0n, extents: [{index: 0n, offset: 0n, length: BigInt(xmp.length)}]}];
  const infos = box('iinf', full(1), u32(entries.length + 2), ...entries.map(e => e.bytes), box('infe', full(3), u32(exifId), u16(0), Buffer.from('Exif'), nul('Copyright')), box('infe', full(3), u32(xmpId), u16(0), Buffer.from('mime'), nul('Copyright'), nul('application/rdf+xml')));
  const referenceVersion = iref ? input[iref.start + iref.header] : 1;
  if (referenceVersion > 1 || (referenceVersion === 0 && xmpId > 0xffff)) throw new Error('Referências AVIF não suportadas.');
  const itemId = referenceVersion === 0 ? u16 : u32;
  const refs = box('iref', full(referenceVersion), ...(iref ? [input.subarray(iref.start + iref.header + 4, iref.end)] : []), ...[exifId, xmpId].map(id => box('cdsc', itemId(id), u16(1), itemId(primary))));
  const buildMeta = () => box('meta', input.subarray(meta.start + meta.header, meta.start + meta.header + 4), ...children.filter(c => !['iinf', 'iloc', 'iref'].includes(c.type)).map(c => c.bytes), infos, writeLocations([...locations, ...extras]), refs);
  const initial = buildMeta(), metadataStart = input.length + initial.length + 8;
  extras[0].extents[0].offset = BigInt(metadataStart); extras[1].extents[0].offset = BigInt(metadataStart + exif.length);
  const replacement = Buffer.from(input);
  // Move only the metadata box; existing image offsets keep pointing to the unchanged image data.
  replacement.fill(0, meta.start, meta.end); replacement.writeUInt32BE(meta.end - meta.start, meta.start); replacement.write('free', meta.start + 4);
  for (const b of top) if (input.readUInt32BE(b.start) === 0) replacement.writeUInt32BE(b.end - b.start, b.start);
  return Buffer.concat([replacement, buildMeta(), box('mdat', exif, xmp)]);
}

/** Add only the approved copyright fields after image processing; never copy GPS/camera metadata. */
export function withCopyright(bytes: Uint8Array, format: 'webp' | 'avif', copyright: string, width: number, height: number): Uint8Array {
  if (!copyright.trim() || copyright.length > 300) throw new Error('Informe os direitos autorais da imagem.');
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return format === 'webp' ? webpRights(input, copyright, width, height) : avifRights(input, copyright);
}
