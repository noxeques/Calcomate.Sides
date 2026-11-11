export const SCHEMA = 1;
export const TIME_ZONE = 'Europe/Istanbul';
export const PRODUCT = 'CalcomateSides';
export const PRODUCT_NOTE = 'CalcomateSides, Calcolit firmasının ürünüdür.';
export const COPYRIGHT = '© 2026 Calcolit. CalcomateSides servis yazılımı Calcolit firmasına aittir. Tüm hakları saklıdır.';

export const CURRENCIES = { TRY: 2, USD: 2, EUR: 2, GBP: 2, CHF: 2, JPY: 0, KWD: 3 } as const;
export type Currency = keyof typeof CURRENCIES;
export const METHODS = { transfer: 'Banka havalesi', cash: 'Nakit', card: 'Kart (alınmış)', other: 'Diğer' } as const;
export type Method = keyof typeof METHODS;
export type ContentKind = 'post' | 'event';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentFields {
  kind: ContentKind;
  title: string;
  summary: string;
  body: string;
  image: string;
  eventDate: string;
  location: string;
}
export interface RecordMeta {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Content extends RecordMeta, ContentFields {
  status: ContentStatus;
  published: { fields: ContentFields; at: string; version: number } | null;
}
export const PAGE_NAMES = {
  home: 'Ana sayfa', about: 'Hakkımızda', posts: 'Paylaşımlar', events: 'Etkinlikler', contact: 'İletişim',
} as const;
export type MenuPage = keyof typeof PAGE_NAMES;
export interface SettingsFields {
  organizationName: string;
  tagline: string;
  introduction: string;
  about: string;
  theme: 'coast' | 'forest';
  primary: string;
  accent: string;
  logo: string;
  menu: MenuPage[];
  email: string;
  phone: string;
  address: string;
  socials: { label: string; url: string }[];
  terms: string;
  privacy: string;
  notice: string;
  support: string;
}
export type Settings = SettingsFields & RecordMeta & { status: 'active' };
export interface DonationFields {
  date: string;
  amountMinor: number;
  currency: Currency;
  method: Method;
  campaign: string;
  donor: string;
  reference: string;
  note: string;
}
export interface Donation extends DonationFields, RecordMeta { status: 'active' | 'cancelled' }
export interface DonationFilter { search?: string; from?: string; to?: string; campaign?: string }
export interface Totals { currency: Currency; count: number; amountMinor: number }
export interface Summary {
  content: Record<ContentKind, Record<ContentStatus, number>>;
  totals: Totals[];
  campaigns: { campaign: string; totals: Totals[] }[];
  campaignOptions: string[];
  publicVersion: number;
}
export interface PublicItem extends ContentFields { id: string; publishedAt: string }
export interface PublicSnapshot {
  schema: 1;
  organizationId: string;
  version: number;
  publishedAt: string;
  settings: SettingsFields;
  items: PublicItem[];
}
export interface Page<T> { items: T[]; page: number; pages: number; total: number }
export type Action = 'content.save' | 'content.publish' | 'content.archive' | 'theme.save' |
  'donation.save' | 'donation.cancel' | 'donation.import' | 'publication.retry';
type LogAction = Exclude<Action, 'publication.retry'>;
export interface HistoryEntry {
  requestId: string;
  action: LogAction;
  actor: string;
  at: string;
  count: number;
  ids: string[];
  publicVersion?: number;
}
export interface Operation extends HistoryEntry { digest: string; records: (Content | Donation | Settings)[] }
export interface PrivateLog { content: Operation[]; donations: Operation[] }
export interface MutationResult { requestId: string; ids: string[]; count: number; repeated: boolean; publicVersion: number }
export interface PublicationStatus { target: number; current: number | null }
export interface AdminApi {
  overview(filter?: DonationFilter): Promise<Summary>;
  contents(query: { page?: number; kind?: ContentKind; status?: ContentStatus; search?: string }): Promise<Page<Content>>;
  theme(): Promise<Settings>;
  donations(query: DonationFilter & { page?: number }): Promise<Page<Donation>>;
  history(page?: number): Promise<Page<HistoryEntry>>;
  publication(): Promise<PublicationStatus>;
  mutate(request: Mutation): Promise<MutationResult>;
  exportData(): Promise<{ schema: 1; organizationId: string; exportedAt: string; log: PrivateLog }>;
  exportDonations(filter?: DonationFilter): Promise<Donation[]>;
}
export type Mutation =
  | { action: 'content.save'; requestId: string; id?: string; version?: number; fields: ContentFields }
  | { action: 'content.publish' | 'content.archive' | 'donation.cancel'; requestId: string; id: string; version: number }
  | { action: 'theme.save'; requestId: string; version: number; fields: SettingsFields }
  | { action: 'donation.save'; requestId: string; id?: string; version?: number; fields: DonationFields }
  | { action: 'donation.import'; requestId: string; rows: DonationFields[] }
  | { action: 'publication.retry'; requestId: string };

export const THEMES = {
  coast: { label: 'Kıyı', primary: '#142b3a', accent: '#007c70' },
  forest: { label: 'Orman', primary: '#26382c', accent: '#536b35' },
} as const;
export const EMPTY_SETTINGS: SettingsFields = {
  organizationName: 'Kuruluş', tagline: '', introduction: '', about: '',
  theme: 'coast', primary: THEMES.coast.primary, accent: THEMES.coast.accent, logo: '',
  menu: ['home', 'about', 'posts', 'events', 'contact'], email: '', phone: '', address: '', socials: [],
  terms: '', privacy: '', notice: '', support: '',
};
export const EMPTY_CONTENT: ContentFields = {
  kind: 'post', title: '', summary: '', body: '', image: '', eventDate: '', location: '',
};
export const SAMPLE_IMAGES = {
  'local:garden': 'Topluluk bahçesi illüstrasyonu',
  'local:workshop': 'Atölye illüstrasyonu',
  'local:shore': 'Kıyı ve yürüyüş yolu illüstrasyonu',
} as const;

export function localDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)?.value).join('-');
}
export function displayDate(value: string, long = false): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TIME_ZONE, day: 'numeric', month: long ? 'long' : 'short', year: 'numeric',
  }).format(new Date(value));
}
export function displayTime(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}
export function displayMoney(amountMinor: number, currency: Currency): string {
  const digits = CURRENCIES[currency];
  const divisor = 10 ** digits;
  const integer = Math.floor(amountMinor / divisor);
  const fraction = String(amountMinor % divisor).padStart(digits, '0');
  const parts = new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: digits,
  }).formatToParts(integer);
  return parts.map((part) => part.type === 'fraction' ? fraction : part.value).join('');
}
