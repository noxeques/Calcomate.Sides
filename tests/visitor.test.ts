import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPublication } from '../apps/visitor/publication';
import { EMPTY_SETTINGS } from '../shared/model';

const endpoint = 'https://script.google.com/macros/s/VISITOR_TEST/exec';
const org = 'visitor-test';
const data = { schema: 1, organizationId: org, version: 5, publishedAt: '2026-11-11T10:00:00.000Z',
  settings: EMPTY_SETTINGS, items: [] };

test('ziyaretçi boş içerikli geçerli yayını çerez ve önbellek kullanmadan okur', async (t) => {
  const controller = new AbortController();
  const mock = t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, endpoint);
    assert.match(url.searchParams.get('fresh') ?? '', /^\d+$/);
    assert.deepEqual(init, {
      cache: 'no-store', credentials: 'omit', mode: 'cors', redirect: 'follow', signal: controller.signal,
    });
    return Response.json({ ok: true, data: { ...data, version: 5 + mock.mock.callCount() } });
  });
  const first = await fetchPublication(endpoint, org, controller.signal);
  const refreshed = await fetchPublication(endpoint, org, controller.signal);
  assert.deepEqual(first.items, []);
  assert.equal(refreshed.version, first.version + 1);
});

test('ziyaretçi yayın yok, servis hatası, geçersiz yanıt ve ağ hatasını ayırır', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch');
  const read = () => fetchPublication(endpoint, org, new AbortController().signal);
  for (const [makeResponse, expectedCode] of [
    [() => Response.json({ ok: false, code: 'EMPTY', message: 'upstream test text' }), 'EMPTY'],
    [() => Response.json({ ok: false, code: 'PUBLIC', message: 'upstream test text' }), 'PUBLIC'],
    [() => Response.json({ ok: false, code: 'EMPTY' }), 'INVALID_PUBLICATION'],
    [() => Response.json({ ok: true, data: { ...data, items: null } }), 'INVALID_PUBLICATION'],
    [() => Response.json({ ok: true, data: { ...data, organizationId: 'other-org' } }), 'CONFIG'],
    [() => new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }), 'INVALID_PUBLICATION'],
    [() => new Response('{', { headers: { 'content-type': 'application/json; charset=utf-8' } }), 'INVALID_PUBLICATION'],
    [() => new Response(null, { status: 503 }), 'CONNECTION'],
  ] as const) {
    mock.mock.mockImplementationOnce(async () => makeResponse());
    await assert.rejects(read, (error: Error & { code?: string }) => {
      assert.equal(error.code, expectedCode);
      assert.doesNotMatch(error.message, /upstream test text/);
      return true;
    });
  }
  const failure = new TypeError('Failed to fetch');
  mock.mock.mockImplementationOnce(async () => { throw failure; });
  await assert.rejects(read, (error) => error === failure);
});
