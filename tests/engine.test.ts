import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, mutate, query } from '../shared/engine';
import { displayMoney, EMPTY_SETTINGS } from '../shared/model';
import type { Donation, Page, Summary } from '../shared/model';
import { actor, donation, event, fixture } from './fixtures';

test('kimliksiz, yanlış yürütme kimlikli ve liste dışı kullanıcı reddedilir', () => {
  assert.throws(() => authorize('', actor, actor), { code: 'AUTH' });
  assert.throws(() => authorize(actor, 'owner@example.invalid', actor), { code: 'AUTH' });
  assert.throws(() => authorize(actor, actor, 'other@example.invalid'), { code: 'AUTH' });
  assert.equal(authorize('ADMIN@EXAMPLE.INVALID', actor, '\n' + actor + ',x@example.invalid'), actor);
});

test('aynı istek yeniden yazılmaz; değişen veri aynı anahtarla kabul edilmez', () => {
  const f = fixture();
  const input = { action: 'donation.save', requestId: 'add-donation-01', fields: donation };
  const first = mutate(f.runtime, input, actor);
  const repeated = mutate(f.runtime, { fields: donation, requestId: input.requestId, action: input.action }, actor);
  assert.equal(repeated.repeated, true);
  assert.deepEqual(first.ids, repeated.ids);
  assert.throws(() => mutate(f.runtime, { ...input, fields: { ...donation, reference: 'OTHER' } }, actor), { code: 'IDEMPOTENCY' });
  assert.throws(() => mutate(f.runtime, input, 'different@example.invalid'), { code: 'IDEMPOTENCY' });
  assert.throws(() => mutate(f.runtime, { action: 'content.save', requestId: input.requestId, fields: event }, actor), { code: 'IDEMPOTENCY' });
  mutate(f.runtime, { ...input, requestId: 'add-donation-02' }, actor);
  assert.equal(f.log.donations.length, 2);
});

test('CSV grubu tümden doğrulanır, geçerli tekrar aynı kayıtları döndürür', () => {
  const f = fixture();
  assert.throws(() => mutate(f.runtime, {
    action: 'donation.import', requestId: 'import-group-bad', rows: [donation, { ...donation, date: '2026-02-30' }],
  }, actor), /Grup satırı 2/);
  assert.deepEqual(f.log.donations, []);
  const input = { action: 'donation.import', requestId: 'import-group-ok1', rows: [donation, donation] };
  const first = mutate(f.runtime, input, actor);
  assert.equal(first.count, 2);
  assert.notEqual(first.ids[0], first.ids[1]);
  assert.deepEqual(mutate(f.runtime, input, actor).ids, first.ids);
  assert.equal(f.log.donations.length, 1);
  mutate(f.runtime, { ...input, requestId: 'import-group-ok2' }, actor);
  assert.equal((query(f.runtime, 'donations') as Page<Donation>).total, 4);
});

test('para hesapları tam sayı, dönem kapsayıcı ve iptaller toplam dışında', () => {
  const f = fixture();
  const result = mutate(f.runtime, { action: 'donation.import', requestId: 'donation-report-1', rows: [
    donation, { ...donation, amountMinor: 5 }, { ...donation, amountMinor: 4500, currency: 'EUR' },
    { ...donation, amountMinor: 100, campaign: 'Genel' }, { ...donation, date: '2026-11-11' },
  ] }, actor);
  mutate(f.runtime, { action: 'donation.cancel', id: result.ids[1], version: 1, requestId: 'cancel-donation-1' }, actor);
  const value = query(f.runtime, 'overview', { from: donation.date, to: donation.date, campaign: donation.campaign }) as Summary;
  assert.deepEqual(value.totals, [
    { currency: 'EUR', count: 1, amountMinor: 4500 }, { currency: 'TRY', count: 1, amountMinor: 12550 },
  ]);
  assert.equal(value.campaigns.length, 1);
  assert.match(displayMoney(12550, 'TRY'), /125,50/);
  assert.match(displayMoney(1234, 'KWD'), /1,234/);
  assert.match(displayMoney(800, 'JPY'), /800/);
});

test('yazma hatası, eski sürüm ve kayıp cevap sonrası yeniden deneme', () => {
  const f = fixture();
  const input = { action: 'donation.save', requestId: 'add-uncertain-1', fields: donation };
  f.faults.append = true;
  assert.throws(() => mutate(f.runtime, input, actor), /write failed/);
  assert.equal(f.log.donations.length, 0);
  f.faults.append = false;
  const append = f.runtime.repository.append;
  f.runtime.repository.append = (...args) => { append(...args); throw new Error('response lost'); };
  assert.throws(() => mutate(f.runtime, input, actor), /response lost/);
  const replay = mutate(f.runtime, input, actor);
  assert.equal(replay.repeated, true);
  assert.equal(f.log.donations.length, 1);
  f.runtime.repository.append = append;
  const edit = { ...input, requestId: 'edit-uncertain-1', id: replay.ids[0], version: 1 };
  mutate(f.runtime, edit, actor);
  assert.throws(() => mutate(f.runtime, { ...edit, requestId: 'edit-uncertain-2' }, actor), { code: 'CONFLICT' });
  assert.equal((query(f.runtime, 'donations') as Page<Donation>).items[0].version, 2);
});

test('yayın yazımı yarıda kalırsa hata döner, tekrar en yeni sürümü yazar', () => {
  const f = fixture();
  const saved = mutate(f.runtime, { action: 'content.save', fields: event, requestId: 'save-for-pub-1' }, actor);
  const input = { action: 'content.publish', id: saved.ids[0], version: 1, requestId: 'publish-retry-1' };
  f.faults.publication = true;
  assert.throws(() => mutate(f.runtime, input, actor), { code: 'PUBLIC_PENDING' });
  assert.equal(f.log.content.length, 2);
  assert.deepEqual(query(f.runtime, 'publication'), { target: 1, current: 0 });
  assert.throws(() => mutate(f.runtime, {
    action: 'theme.save', version: 0, requestId: 'theme-public-001', fields: { ...EMPTY_SETTINGS, organizationName: 'Yeni ad' },
  }, actor), { code: 'PUBLIC_PENDING' });
  f.faults.publication = false;
  assert.equal(mutate(f.runtime, input, actor).repeated, true);
  assert.deepEqual(query(f.runtime, 'publication'), { target: 2, current: 2 });
  assert.equal(f.publication?.settings.organizationName, 'Yeni ad');
  assert.equal(f.log.content.length, 3);
});

test('kuruluş günlükleri, yayın sürümleri ve istek kimlikleri ayrı kalır', () => {
  const a = fixture('yesil-iz'), b = fixture('mavi-kopru');
  for (const f of [a, b]) mutate(f.runtime, {
    action: 'theme.save', requestId: 'same-id-theme', version: 0,
    fields: { ...EMPTY_SETTINGS, organizationName: f.runtime.organizationId },
  }, actor);
  mutate(a.runtime, { action: 'donation.save', fields: donation, requestId: 'private-org-a' }, actor);
  assert.equal(a.publication?.organizationId, 'yesil-iz');
  assert.equal(b.publication?.organizationId, 'mavi-kopru');
  assert.equal((query(b.runtime, 'donations') as Page<Donation>).total, 0);
  assert.equal(a.publication?.version, b.publication?.version);
  assert.ok(!JSON.stringify(a.publication).includes(donation.donor));
});

test('yönetim listesi filtreyi uygulayıp kayıtları 12’li sayfalar', () => {
  const f = fixture();
  mutate(f.runtime, {
    action: 'donation.import', requestId: 'many-donations', rows: Array.from({ length: 27 }, (_, i) =>
      ({ ...donation, reference: 'R-' + i, campaign: i === 0 ? 'Diğer' : 'Bahçe' })),
  }, actor);
  const page = query(f.runtime, 'donations', { page: 3, campaign: 'Bahçe' }) as Page<Donation>;
  assert.equal(page.items.length, 2);
  assert.equal(page.pages, 3);
  assert.equal(page.total, 26);
  assert.equal((query(f.runtime, 'donations', { search: 'R-26' }) as Page<Donation>).total, 1);
});
