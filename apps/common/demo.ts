import { mutate, query } from '../../shared/engine';
import type { Repository, Runtime } from '../../shared/engine';
import { EMPTY_CONTENT, EMPTY_SETTINGS, localDate, THEMES } from '../../shared/model';
import type { AdminApi, DonationFields, Mutation, PrivateLog, PublicSnapshot } from '../../shared/model';
import { AppError, requireValue } from '../../shared/validation';

const NAMES = { 'yesil-iz': 'Yeşil İz Derneği', 'mavi-kopru': 'Mavi Köprü Derneği' };
type DemoOrg = keyof typeof NAMES;
interface DemoState { log: PrivateLog; publication: PublicSnapshot | null }
const actor = 'yonetim@example.invalid';
const storeKey = (org: DemoOrg) => 'calcomatesides:demo:v1:' + org;
export function demoOrg(): DemoOrg {
  const org = new URLSearchParams(location.search).get('org');
  requireValue(!org || org === 'yesil-iz' || org === 'mavi-kopru', 'Demo kuruluşu tanınmıyor.', 'CONFIG');
  return org === 'mavi-kopru' ? org : 'yesil-iz';
}
function runtime(org: DemoOrg, state: DemoState, save: () => void, digest = '', now = () => new Date().toISOString()): Runtime {
  const repository: Repository = {
    read: (stream) => state.log[stream],
    append: (stream, operation) => { state.log[stream].push(operation); save(); },
    readPublic: () => state.publication,
    replacePublic: (snapshot) => { state.publication = snapshot; save(); },
  };
  return { organizationId: org, repository, digest: () => digest, now };
}
function relativeDate(days: number): string { return localDate(new Date(Date.now() + days * 86_400_000)); }
function seed(org: DemoOrg): DemoState {
  const state: DemoState = { log: { content: [], donations: [] }, publication: null };
  let timestamp = Date.parse(localDate() + 'T07:00:00.000Z');
  const context = runtime(org, state, () => {}, '', () => new Date(timestamp += 1000).toISOString());
  const green = org === 'yesil-iz';
  mutate(context, { action: 'theme.save', version: 0, requestId: 'seed-theme-01', fields: {
    ...EMPTY_SETTINGS, organizationName: NAMES[org],
    tagline: green ? 'Birlikte daha yeşil bir gelecek.' : 'Birlikte daha güçlü bir mahalle.',
    introduction: green
      ? 'Doğayı korumak, kentte yeşil alanları büyütmek ve dayanışmayı çoğaltmak için bir araya geliyoruz.'
      : 'Mahallede öğrenmeyi, paylaşmayı ve dayanışmayı birlikte büyütüyoruz.',
    about: green
      ? 'Yeşil İz Derneği, CalcomateSides’ı tanıtmak için oluşturulmuş örnek bir kuruluştur. Demo, kent ekolojisi çevresinde örgütlenen bir topluluğun duyuru ve etkinliklerini gösterir.'
      : 'Mavi Köprü Derneği, ayrı kuruluş kurulumunu göstermek için oluşturulmuş örnek bir topluluktur.',
    theme: green ? 'coast' : 'forest', primary: green ? THEMES.coast.primary : THEMES.forest.primary,
    accent: green ? THEMES.coast.accent : THEMES.forest.accent,
    email: green ? 'iletisim@yesil-iz.example' : 'iletisim@mavi-kopru.example',
    address: 'İstanbul, Türkiye · Örnek kuruluş',
    terms: 'Taslak · Kuruluşun kullanım koşulları yayın öncesinde eklenir.',
    privacy: 'Taslak · Kuruluşun gizlilik politikası yayın öncesinde eklenir.',
    notice: 'Taslak · İlgili aydınlatma metni yayın öncesinde eklenir.',
  } }, actor);
  const entries = green ? [
    { ...EMPTY_CONTENT, kind: 'event' as const, title: 'Topluluk Bahçesinde Buluşuyoruz', eventDate: relativeDate(14), location: 'Kadıköy, İstanbul',
      summary: 'Birlikte tohum ekmek ve toprağı tanımak için bahçede buluşuyoruz.', body: 'Yeni başlayanlara açık bu örnek etkinlikte mevsimlik ekim üzerine konuşuyoruz. Açık havaya uygun giysilerle gelebilirsiniz.', image: 'local:garden' },
    { ...EMPTY_CONTENT, kind: 'event' as const, title: 'Kıyıda Gönüllü Yürüyüşü', eventDate: relativeDate(28), location: 'Moda Sahili, İstanbul',
      summary: 'Kıyıda gözlem ve çevre temizliği için birlikte yürüyelim.', body: 'Örnek buluşmanın rotası sahil parkından başlayıp yürüyüş yolunda devam eder.', image: 'local:shore' },
    { ...EMPTY_CONTENT, kind: 'event' as const, title: 'Tohum Takas Atölyesi', eventDate: relativeDate(36), location: 'Kadıköy, İstanbul',
      summary: 'Yerel tohumlarla ilgili deneyimlerimizi paylaşacağız.', body: 'Bu örnek atölye, yerel türleri tanımaya ve tohum paylaşmaya ayrılmıştır.', image: 'local:workshop' },
    { ...EMPTY_CONTENT, title: 'Bahçeden mevsim notları', summary: 'Topluluk bahçemizde bu mevsim öğrendiklerimizi derledik.',
      body: 'Kent içinde küçük bir ekim alanı bile bir araya gelmek için fırsat yaratır. Örnek yazımızda bahçeyi kurarken yaptığımız gözlemleri paylaşıyoruz.', image: 'local:workshop' },
    { ...EMPTY_CONTENT, title: 'Gönüllü çağrısı', summary: 'Yeni dönem için taslak duyuru.', body: 'Bu taslak yalnızca yönetimde görünür.' },
  ] : [
    { ...EMPTY_CONTENT, kind: 'event' as const, title: 'Mahallede Okuma Buluşması', eventDate: relativeDate(18), location: 'Üsküdar, İstanbul',
      summary: 'Birlikte okumaya ve sohbet etmeye davetlisiniz.', body: 'Bu örnek etkinlikte kısa bir öykü okuyup görüşlerimizi paylaşacağız.', image: 'local:workshop' },
    { ...EMPTY_CONTENT, title: 'Mahalle kütüphanesi açılıyor', summary: 'Dayanışma rafımız için hazırlıklar başladı.', body: 'Bu örnek yazı yalnızca Mavi Köprü’nün yayın kopyasında yer alır.' },
  ];
  entries.forEach((fields, index) => {
    const saved = mutate(context, { action: 'content.save', requestId: 'seed-content-' + index, fields }, actor);
    if (fields.title !== 'Gönüllü çağrısı') {
      mutate(context, { action: 'content.publish', requestId: 'seed-publish-' + index, id: saved.ids[0], version: 1 }, actor);
    }
  });
  const rows: DonationFields[] = (green ? [245_000, 180_000, 395_000, 125_000, 275_000, 405_000] : [600_000]).map((amountMinor, i) => ({
    date: relativeDate(i === 5 ? -4 : -i * 3), amountMinor, currency: i === 5 ? 'EUR' : 'TRY', method: i % 2 ? 'cash' : 'transfer',
    campaign: green ? (i % 2 ? 'Kent Bahçesi' : 'Genel destek') : 'Mahalle Kitaplığı',
    donor: 'Örnek bağışçı ' + (i + 1), reference: 'DEMO-' + (100 + i), note: '',
  }));
  mutate(context, { action: 'donation.import', requestId: 'seed-donations-01', rows }, actor);
  return state;
}
function read(org: DemoOrg): DemoState {
  const text = localStorage.getItem(storeKey(org));
  return text ? JSON.parse(text) as DemoState : seed(org);
}
export async function readDemoPublication(): Promise<PublicSnapshot | null> {
  return read(demoOrg()).publication;
}
export async function sha(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
}
export function demoAdmin(): AdminApi {
  const org = demoOrg();
  const run = async <T>(name: string, params?: unknown) => query(runtime(org, read(org), () => {}), name, params) as T;
  return {
    overview: (filter) => run('overview', filter),
    contents: (filter) => run('contents', filter),
    theme: () => run('theme'),
    donations: (filter) => run('donations', filter),
    history: (page) => run('history', page),
    publication: () => run('publication'),
    exportData: () => run('exportData'),
    exportDonations: (filter) => run('exportDonations', filter),
    async mutate(request: Mutation) {
      requireValue(navigator.locks, 'Demo kayıtları için Web Locks destekli bir tarayıcı gerekli.', 'CONFIG');
      const digest = await sha(canonical(request));
      return navigator.locks.request(storeKey(org), () => {
        const state = read(org);
        try {
          return mutate(runtime(org, state, () => localStorage.setItem(storeKey(org), JSON.stringify(state)), digest), request, actor);
        } catch (error) {
          if (error instanceof AppError) throw error;
          throw new AppError('WRITE_UNKNOWN', 'Demo depolama işlemi doğrulanamadı. Aynı isteği yeniden deneyin.');
        }
      });
    },
  };
}
