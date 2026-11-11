import { createHash } from 'node:crypto';
import { EMPTY_CONTENT } from '../shared/model';
import type { Runtime } from '../shared/engine';
import type { DonationFields, PrivateLog, PublicSnapshot } from '../shared/model';

export function fixture(organizationId = 'yesil-iz') {
  const log: PrivateLog = { content: [], donations: [] };
  let publication: PublicSnapshot | null = null;
  const faults = { append: false, publication: false };
  const runtime: Runtime = {
    organizationId,
    now: () => '2026-11-10T12:30:00.000Z',
    digest: (value) => createHash('sha256').update(value).digest('hex'),
    repository: {
      read: (stream) => structuredClone(log[stream]),
      append: (stream, operation) => {
        if (faults.append) throw new Error('write failed');
        log[stream].push(structuredClone(operation));
      },
      readPublic: () => publication && structuredClone(publication),
      replacePublic: (next) => {
        if (faults.publication) throw new Error('publication failed');
        publication = structuredClone(next);
      },
    },
  };
  return { runtime, log, faults, get publication() { return publication; } };
}
export const actor = 'admin@example.invalid';
export const event = { ...EMPTY_CONTENT, kind: 'event' as const, title: 'Sonbahar buluşması', eventDate: '2026-11-21', location: 'İstanbul', body: 'Buluşma açıklaması' };
export const donation: DonationFields = {
  date: '2026-11-10', amountMinor: 12550, currency: 'TRY', method: 'cash',
  campaign: 'Kent bahçesi', donor: 'Örnek kişi', reference: 'REF-01', note: '',
};
