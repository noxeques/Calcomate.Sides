import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { EMPTY_SETTINGS } from '../shared/model';
import { mutate, query } from '../shared/engine';
import { inspectPublication, readPublication } from '../scripts/pilot/public-check';
import { actor, event, fixture } from './fixtures';

const endpoint = 'https://script.google.com/macros/s/PILOT_TEST/exec';
const snapshot = { schema: 1, organizationId: 'calcomatesides-pilot', version: 1,
  publishedAt: '2026-11-11T10:00:00.000Z', settings: EMPTY_SETTINGS,
  items: [{ ...event, id: 'pilot-event-001', publishedAt: '2026-11-11T10:00:00.000Z' }] };
const reply = { ok: true, data: snapshot };

test('pilot kontrolü ham yanıttaki özel alanları süzmek yerine hata olarak raporlar', () => {
  assert.throws(() => inspectPublication({ ok: false, code: 'EMPTY', message: 'Henüz yayın yok' }, 'calcomatesides-pilot'), { code: 'PUBLIC' });
  assert.throws(() => inspectPublication({ ...reply, donations: [] }, 'calcomatesides-pilot'), { code: 'PRIVACY' });
  assert.throws(() => inspectPublication({ ...reply, data: { ...snapshot,
    settings: { ...EMPTY_SETTINGS, ADMIN_EMAILS: actor } } }, 'calcomatesides-pilot'), { code: 'PRIVACY' });
  assert.throws(() => inspectPublication({ ...reply, data: { ...snapshot,
    items: [{ ...snapshot.items[0], status: 'draft' }] } }, 'calcomatesides-pilot'), { code: 'PRIVACY' });
  assert.throws(() => inspectPublication(reply, 'another-pilot'), { code: 'CONFIG' });
  assert.throws(() => inspectPublication(reply, 'calcomatesides-pilot', {
    privateSentinels: [snapshot.items[0].title],
  }), { code: 'PRIVACY' });
  assert.equal(inspectPublication(reply, 'calcomatesides-pilot', { present: 'pilot-event-001' }).version, 1);
  assert.throws(() => inspectPublication(reply, 'calcomatesides-pilot', { absent: 'pilot-event-001' }), { code: 'EXPECTATION' });
});

test('pilot HTTP kontrolü yönlendirmeyi çerezsiz takip eder, Google girişine gitmez', async () => {
  let calls = 0;
  const result = await readPublication(endpoint, async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    calls++;
    return url.hostname === 'script.google.com'
      ? new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/macros/echo?privateRedirectToken=test' } })
      : Response.json(reply);
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.redirects, [
    { host: 'script.google.com', status: 302 }, { host: 'script.googleusercontent.com', status: 200 },
  ]);
  assert.ok(!JSON.stringify(result.redirects).includes('privateRedirectToken'));
  await assert.rejects(() => readPublication(endpoint, async () =>
    new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/login' } })), { code: 'REDIRECT' });
  await assert.rejects(() => readPublication(endpoint, async () => new Response('<html>Login</html>', {
    headers: { 'content-type': 'text/html' },
  })), { code: 'PUBLIC' });
  await assert.rejects(() => readPublication(endpoint, async () => new Response('x'.repeat(2_000_001), {
    headers: { 'content-type': 'application/json' },
  })), { code: 'LIMIT' });
});

test('pilot tekrar dosyası gerçek motorla iki kez çalıştırıldığında iki günlük kaydı bırakır', async () => {
  const source = await readFile('scripts/pilot/ReplayCheck.gs', 'utf8');
  const pilot = fixture('calcomatesides-pilot');
  const expectedSheets = {
    CONTENT_SHEET_ID: 'fixture-content-sheet-001',
    DONATIONS_SHEET_ID: 'fixture-donation-sheet-001',
    PUBLIC_SHEET_ID: 'fixture-publication-sheet-001',
  };
  const config: Record<string, string> = {
    ORGANIZATION_ID: 'calcomatesides-pilot',
    ...expectedSheets,
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => config[key] }) },
    adminMutate: (request: unknown) => ({ ok: true, data: mutate(pilot.runtime, request, actor) }),
    adminQuery: (name: string, params: unknown) => ({ ok: true, data: query(pilot.runtime, name, params) }),
    Logger: { log() {} },
  });
  vm.runInContext(source, context);
  assert.throws(() => vm.runInContext('pilotReplayCheck()', context), /Pilot yapılandırması/);
  config.PILOT_REPLAY_SHEET_IDS = JSON.stringify({ ...expectedSheets, DONATIONS_SHEET_ID: 'unmatched-donation-sheet-001' });
  assert.throws(() => vm.runInContext('pilotReplayCheck()', context), /Pilot yapılandırması/);
  assert.equal(pilot.log.donations.length, 0);
  config.PILOT_REPLAY_SHEET_IDS = JSON.stringify(expectedSheets);
  vm.runInContext('pilotReplayCheck()', context);
  vm.runInContext('pilotReplayCheck()', context);
  assert.equal(pilot.log.donations.length, 2);
  assert.ok(pilot.log.donations.every((entry) => entry.records[0].status === 'active'));
  config.ORGANIZATION_ID = 'real-organization';
  assert.throws(() => vm.runInContext('pilotReplayCheck()', context), /Pilot yapılandırması/);
  assert.equal(pilot.log.donations.length, 2);
});
