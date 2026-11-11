import { AppError, requireValue } from '../shared/validation';

export const WIDTH = 64;
export const LAST_COLUMN = 'BL';
const CHUNK_SIZE = 20_000;
export type Store = 'content' | 'donations' | 'public';
export const TAB: Record<Store, string> = { content: 'ContentLog', donations: 'DonationLog', public: 'Publication' };
export function marker(org: string, store: Store): string { return 'CalcomateSides/1:' + org + ':' + store; }
export function verifyMarker(value: unknown, org: string, store: Store): void {
  requireValue(value === marker(org, store), TAB[store] + ' sekmesinin kuruluş işareti eksik veya uyuşmuyor.', 'CONFIG');
}
export function encode(value: unknown): string[] {
  const json = JSON.stringify(value);
  const chunks: string[] = [];
  for (let start = 0; start < json.length;) {
    let end = Math.min(start + CHUNK_SIZE, json.length);
    const boundary = json.charCodeAt(end - 1);
    if (end < json.length && boundary >= 0xd800 && boundary <= 0xdbff) end--;
    chunks.push(json.slice(start, end));
    start = end;
  }
  requireValue(chunks.length <= WIDTH, 'Tek işlemde yazılabilecek veri sınırı aşıldı.', 'LIMIT');
  return chunks;
}
export function decode<T>(cells: unknown[]): T {
  try {
    requireValue(cells.length && cells.every((cell) => typeof cell === 'string'), 'Hücre yapısı geçersiz.');
    return JSON.parse(cells.join('')) as T;
  } catch {
    throw new AppError('STORAGE', 'Sheets kaydı okunamadı. Yedek ve sekme yapısını kontrol edin.');
  }
}
