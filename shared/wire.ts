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
export function visitorReply(raw: Envelope<unknown>, expected: string): PublicSnapshot {
  const snapshot = publicSnapshot(unwrap(raw));
  requireValue(snapshot.organizationId === expected, 'Yayın kaynağı yapılandırılan kuruluşla eşleşmiyor.', 'CONFIG');
  return snapshot;
}
