import { pathToFileURL } from 'node:url';
import type { PublicSnapshot } from '../../shared/model';
import { AppError, identifier, object, requireValue } from '../../shared/validation';
import { publicEndpoint, visitorReply } from '../../shared/wire';

const SETTINGS = ['organizationName', 'tagline', 'introduction', 'about', 'theme', 'primary', 'accent', 'logo',
  'menu', 'email', 'phone', 'address', 'socials', 'terms', 'privacy', 'notice', 'support'];
const ITEM = ['kind', 'title', 'summary', 'body', 'image', 'eventDate', 'location', 'id', 'publishedAt'];
const LIMIT = 2_000_000;
interface Expectations { present?: string; absent?: string; privateSentinels?: string[] }
function exactKeys(value: unknown, keys: string[], location: string) {
  const data = object(value);
  requireValue(Object.keys(data).length === keys.length && keys.every((key) => Object.hasOwn(data, key)),
    location + ' alanları yayın sözleşmesiyle eşleşmiyor.', 'PRIVACY');
  return data;
}
export function inspectPublication(raw: unknown, org: string, expected: Expectations = {}): PublicSnapshot {
  const envelope = object(raw);
  if (envelope.ok === false) {
    exactKeys(raw, ['ok', 'code', 'message'], 'Hata yanıtı');
    const code = typeof envelope.code === 'string' && /^[A-Z_]{1,30}$/.test(envelope.code) ? envelope.code : 'UNKNOWN';
    throw new AppError('PUBLIC', 'Yayın servisi hata döndürdü (' + code + ').');
  }
  const reply = exactKeys(raw, ['ok', 'data'], 'Yanıt');
  requireValue(reply.ok === true, 'Yayın servisi başarılı JSON döndürmedi.', 'PUBLIC');
  const data = exactKeys(reply.data, ['schema', 'organizationId', 'version', 'publishedAt', 'settings', 'items'], 'Yayın');
  const settings = exactKeys(data.settings, SETTINGS, 'Ayarlar');
  requireValue(Array.isArray(settings.socials), 'Sosyal bağlantılar geçersiz.');
  settings.socials.forEach((item) => exactKeys(item, ['label', 'url'], 'Sosyal bağlantı'));
  requireValue(Array.isArray(data.items), 'Yayın listesi geçersiz.');
  data.items.forEach((item) => exactKeys(item, ITEM, 'İçerik'));
  const snapshot = visitorReply({ ok: true, data }, org);
  if (expected.present) {
    const id = identifier(expected.present);
    requireValue(snapshot.items.some((item) => item.id === id), 'Beklenen etkinlik yayında bulunamadı.', 'EXPECTATION');
  }
  if (expected.absent) {
    const id = identifier(expected.absent);
    requireValue(!snapshot.items.some((item) => item.id === id), 'Bulunmaması gereken etkinlik yayında görünüyor.', 'EXPECTATION');
  }
  const serialized = JSON.stringify(raw);
  requireValue(!(expected.privateSentinels ?? []).filter(Boolean).some((text) => serialized.includes(text)),
    'Özel test işareti anonim yanıtta bulundu.', 'PRIVACY');
  return snapshot;
}

type Fetcher = (url: URL, options: RequestInit) => Promise<Response>;
export async function readPublication(endpoint: string, fetcher: Fetcher = fetch) {
  let url = new URL(publicEndpoint(endpoint));
  url.searchParams.set('fresh', String(Date.now()));
  const redirects: { host: string; status: number }[] = [];
  const signal = AbortSignal.timeout(30_000);
  for (let attempt = 0; attempt <= 5; attempt++) {
    requireValue(url.protocol === 'https:' && !url.username && !url.password &&
      ['script.google.com', 'script.googleusercontent.com'].includes(url.hostname),
    'Google yayın yönlendirmesi beklenmeyen adrese gitti. Anonim dağıtımı kontrol edin.', 'REDIRECT');
    const response = await fetcher(url, { redirect: 'manual', credentials: 'omit', cache: 'no-store', signal });
    redirects.push({ host: url.hostname, status: response.status });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      requireValue(location, 'Yönlendirme adresi eksik.', 'REDIRECT');
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    requireValue(response.ok, 'Anonim yayın HTTP hatası verdi (' + response.status + ').', 'HTTP');
    requireValue(response.headers.get('content-type')?.includes('application/json'),
      'JSON yerine farklı içerik geldi. Google giriş ekranına yönlendirmeyi kontrol edin.', 'PUBLIC');
    requireValue(response.body, 'Yayın gövdesi boş.', 'PUBLIC');
    const parts: Uint8Array[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        requireValue(bytes <= LIMIT, 'Yayın yanıtı boyut sınırını aştı.', 'LIMIT');
        parts.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    try {
      return { raw: JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown, redirects };
    } catch {
      throw new AppError('PUBLIC', 'Yayın yanıtı geçerli JSON değil.');
    }
  }
  throw new AppError('REDIRECT', 'Google yayın yönlendirmesi sınırı aşıldı.');
}

async function main() {
  try {
    const endpoint = process.env.CALCOMATESIDES_PUBLIC_EXEC_URL ?? '';
    const org = process.env.VITE_ORGANIZATION_ID ?? 'calcomatesides-pilot';
    const result = await readPublication(endpoint);
    const snapshot = inspectPublication(result.raw, org, {
      present: process.env.CALCOMATESIDES_EXPECT_EVENT_ID,
      absent: process.env.CALCOMATESIDES_ABSENT_EVENT_ID,
      privateSentinels: ['ORNEK-PILOT-ELLE-01', 'ORNEK-PILOT-CSV-01',
        ...(process.env.CALCOMATESIDES_PRIVATE_SENTINEL ? [process.env.CALCOMATESIDES_PRIVATE_SENTINEL] : [])],
    });
    console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), organizationId: snapshot.organizationId,
      version: snapshot.version, publishedAt: snapshot.publishedAt, itemCount: snapshot.items.length,
      redirects: result.redirects, verification: 'Anonim HTTP. Tarayıcı CORS kontrolü ayrıca yapılmalı.' }, null, 2));
  } catch (error) {
    console.error(error instanceof AppError ? error.code + ' · ' + error.message : 'Anonim Google yayını okunamadı.');
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
