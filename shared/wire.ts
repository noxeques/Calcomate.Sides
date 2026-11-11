import type { PublicSnapshot } from './model';
import { AppError, publicSnapshot, requireValue } from './validation';

export type Envelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };
export function unwrap<T>(reply: Envelope<T>): T {
  if (reply?.ok === true) return reply.data;
  if (reply?.ok === false) throw new AppError(reply.code, reply.message);
  throw new AppError('CONNECTION', 'Sunucudan beklenen yanıt alınamadı.');
}
export function publicEndpoint(value: string): string {
  requireValue(/^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/[a-z0-9.-]+\/s)\/[a-z0-9_-]+\/exec$/i.test(value),
    'Kurulum eksik. Kamuya açık Apps Script /exec adresini tanımlayın.', 'CONFIG');
  return value;
}
export function invalidPublication(): AppError {
  return new AppError('PUBLIC_INVALID', 'Yayın kaynağı geçersiz bir yanıt verdi.');
}
export function visitorReply(raw: unknown, expected: string): PublicSnapshot {
  if (!raw || typeof raw !== 'object' || !('ok' in raw)) throw invalidPublication();
  if (raw.ok === false && 'code' in raw && 'message' in raw &&
    typeof raw.message === 'string' && raw.message.trim()) {
    if (raw.code === 'EMPTY') throw new AppError('EMPTY', 'Henüz bir yayın kopyası oluşturulmadı.');
    if (raw.code === 'PUBLIC') throw new AppError('PUBLIC', 'Yayın kaynağına şu anda erişilemiyor.');
  }
  if (raw.ok !== true || !('data' in raw)) throw invalidPublication();
  let snapshot: PublicSnapshot;
  try {
    snapshot = publicSnapshot(raw.data);
  } catch (error) {
    if (error instanceof AppError) throw invalidPublication();
    throw error;
  }
  requireValue(snapshot.organizationId === expected, 'Yayın kaynağı yapılandırılan kuruluşla eşleşmiyor.', 'CONFIG');
  return snapshot;
}
