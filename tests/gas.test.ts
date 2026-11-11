import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { adminMutate, adminQuery, doGet as adminPage } from '../gas/admin/main';
import { doGet as publicGet } from '../gas/public/main';
import { decode, encode, marker, TAB, WIDTH } from '../gas/codec';
import type { Store } from '../gas/codec';
import { EMPTY_SETTINGS } from '../shared/model';
import type { MutationResult } from '../shared/model';
import { publicEndpoint, visitorReply } from '../shared/wire';
import { actor, donation, event } from './fixtures';

function googleStub() {
  const org = 'yesil-iz';
  const ids = { content: 'content-sheet-00000001', donations: 'donation-sheet-0000001', public: 'public-sheet-000000001' };
  const stores: Store[] = ['content', 'donations', 'public'];
  const sheet = Object.fromEntries(stores.map((store) => [store, [[marker(org, store)]]])) as Record<Store, string[][]>;
  const account = { active: actor, effective: actor };
  const props: Record<string, string> = {
    ADMIN_EMAILS: actor, ORGANIZATION_ID: org, CONTENT_SHEET_ID: ids.content,
    DONATIONS_SHEET_ID: ids.donations, PUBLIC_SHEET_ID: ids.public,
  };
  const lookup = (id: string) => {
    const key = stores.find((store) => ids[store] === id);
    assert.ok(key, 'only configured files may be accessed');
    return key;
  };
  const calls = { access: 0, releases: 0, locked: false, unavailable: false, ranges: [] as string[] };
  const owner = {
    setTitle() { return this; },
    addMetaTag() { return this; },
  };
  Object.assign(globalThis, {
    Session: { getActiveUser: () => ({ getEmail: () => account.active }), getEffectiveUser: () => ({ getEmail: () => account.effective }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => props[key] ?? null }) },
    HtmlService: { createHtmlOutput: (body: string) => ({ ...owner, body }), createHtmlOutputFromFile: (body: string) => ({ ...owner, body }) },
    LockService: { getScriptLock: () => ({
      tryLock() { if (calls.unavailable) return false; assert.equal(calls.locked, false); return calls.locked = true; },
      releaseLock() { assert.equal(calls.locked, true); calls.locked = false; calls.releases++; },
    }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_: unknown, value: string) => [...createHash('sha256').update(value).digest()],
    },
    Sheets: {
      Spreadsheets: {
        Values: { get(id: string, range: string) {
          calls.access++;
          const store = lookup(id);
          assert.match(range, new RegExp('^' + TAB[store] + '!A1:BL'));
          calls.ranges.push(range);
          return { values: structuredClone(range.endsWith('BL2') ? sheet[store].slice(0, 2) : sheet[store]) };
        } },
        get(id: string) {
          calls.access++;
          const store = lookup(id);
          return { sheets: [{ properties: { title: TAB[store], sheetId: stores.indexOf(store), gridProperties: { columnCount: WIDTH, rowCount: 2 } } }] };
        },
        batchUpdate(body: { requests: Record<string, { rows: { values: { userEnteredValue: { stringValue: string } }[] }[] }>[] }, id: string) {
          calls.access++;
          assert.ok(calls.locked);
          const store = lookup(id);
          const request = body.requests[0];
          const row = (request.appendCells ?? request.updateCells).rows[0].values.map((cell) => {
            assert.deepEqual(Object.keys(cell.userEnteredValue), ['stringValue']);
            return cell.userEnteredValue.stringValue;
          });
          if (store === 'public') {
            assert.ok(request.updateCells);
            sheet.public[1] = row;
          } else {
            assert.ok(request.appendCells);
            sheet[store].push(row);
          }
        },
      },
    },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: (data: string) => ({ setMimeType: (type: string) => {
      assert.equal(type, 'JSON');
      return JSON.parse(data);
    } }) },
  });
  return { account, calls, ids, props, sheet };
}

test('Apps Script giriş ve RPC çağrıları kimlik yokken Sheets’e dokunmaz', () => {
  const s = googleStub();
  for (const active of ['', 'unlisted@example.invalid']) {
    s.account.active = s.account.effective = active;
    assert.match((adminPage() as unknown as { body: string }).body, /erişim reddedildi/);
    assert.match(JSON.stringify(adminQuery('exportData', { email: actor, admin: true })), /"AUTH"/);
    assert.match(JSON.stringify(adminMutate({ action: 'donation.save', email: actor, admin: true })), /"AUTH"/);
  }
  assert.equal(s.calls.access, 0);
  s.account.active = s.account.effective = actor;
  s.calls.unavailable = true;
  assert.match(JSON.stringify(adminMutate({ action: 'donation.save', fields: donation })), /"BUSY"/);
  assert.equal(s.calls.access, 0);
});

test('Google adaptörü private günlüğü ayrı tutar ve public uç izinli alanları döndürür', () => {
  const s = googleStub();
  const item = adminMutate({ action: 'content.save', requestId: 'event-google-01', fields: event });
  assert.equal(item.ok, true);
  assert.equal((publicGet() as { code: string }).code, 'EMPTY');
  const id = (item.data as MutationResult).ids[0];
  const draft = adminMutate({ action: 'content.save', requestId: 'draft-google-01', fields: { ...event, title: 'ÖZEL TASLAK' } });
  assert.equal(draft.ok, true);
  const input = { action: 'donation.save', requestId: 'donation-google-01', fields: { ...donation, donor: 'ÖZEL BAĞIŞÇI', note: '=1+2' } };
  assert.equal(adminMutate(input).ok, true);
  assert.equal((adminMutate(input).data as MutationResult).repeated, true);
  assert.equal(s.sheet.donations.length, 2);
  assert.equal(adminMutate({ action: 'content.publish', requestId: 'publish-google-01', id, version: 1 }).ok, true);
  const copied = decode<{ settings: typeof EMPTY_SETTINGS; items: object[] }>(s.sheet.public[1]);
  // A misconfigured publication document with extra keys still cannot widen the response.
  s.sheet.public[1] = encode({
    ...copied, donations: ['ÖZEL BAĞIŞÇI'], actor,
    settings: { ...copied.settings, ADMIN_EMAILS: actor },
    items: [{ ...copied.items[0], privateNote: 'ÖZEL TASLAK' }],
  });
  s.calls.ranges.length = 0;
  const reply = Reflect.apply(publicGet, null, [{ parameter: { sheetId: s.ids.donations, callback: 'pwn' } }]);
  assert.deepEqual(s.calls.ranges, ['Publication!A1:BL2']);
  const text = JSON.stringify(reply);
  assert.match(text, new RegExp(event.title));
  for (const key of ['ÖZEL BAĞIŞÇI', 'ÖZEL TASLAK', actor, 'ADMIN_EMAILS', 'privateNote', '"donations"']) assert.ok(!text.includes(key));
  assert.equal(s.calls.releases, 5);
  s.props.ORGANIZATION_ID = 'mavi-kopru';
  assert.deepEqual((publicGet() as { ok: boolean }).ok, false);
});

test('Sheets parçaları Unicode sınırını korur ve bozuk satır kapalı kalır', () => {
  const value = { text: 'x'.repeat(19_990) + '🌱'.repeat(21_000) };
  const chunks = encode(value);
  assert.ok(chunks.length > 1);
  assert.deepEqual(decode(chunks), value);
  assert.throws(() => decode([chunks[0], null]), { code: 'STORAGE' });
});

test('ziyaretçi yalnızca yapılandırılmış Google kaynağını ve eşleşen kuruluşu kabul eder', () => {
  assert.throws(() => publicEndpoint(''), { code: 'CONFIG' });
  assert.throws(() => publicEndpoint('https://script.google.com.evil.test/macros/s/ABC/exec'), { code: 'CONFIG' });
  assert.equal(publicEndpoint('https://script.google.com/macros/s/ABC/exec'), 'https://script.google.com/macros/s/ABC/exec');
  const data = { schema: 1, organizationId: 'yesil-iz', version: 1, publishedAt: '2026-11-10T12:30:00.000Z', settings: EMPTY_SETTINGS, items: [] };
  assert.throws(() => visitorReply({ ok: true, data }, 'mavi-kopru'), { code: 'CONFIG' });
  assert.equal(visitorReply({ ok: true, data }, 'yesil-iz').version, 1);
});

test('ziyaretçi boş yayını, servis hatasını ve bozuk yanıtı ayırır', () => {
  assert.throws(() => visitorReply({ ok: false, code: 'EMPTY', message: 'Henüz yayın yok.' }, 'yesil-iz'), { code: 'EMPTY' });
  assert.throws(() => visitorReply({ ok: false, code: 'PUBLIC', message: 'Servis ayrıntısı' }, 'yesil-iz'),
    { code: 'PUBLIC', message: 'Yayın kaynağına şu anda erişilemiyor.' });
  for (const raw of [
    null, { ok: false, code: 'EMPTY', message: '' }, { ok: false, code: 'PUBLIC', message: ' ' },
    { ok: false, code: 'UNKNOWN', message: 'Beklenmeyen hata' }, { ok: true, data: { items: [] } },
  ]) {
    assert.throws(() => visitorReply(raw, 'yesil-iz'),
      { code: 'PUBLIC_INVALID', message: 'Yayın kaynağı geçersiz bir yanıt verdi.' });
  }
});
