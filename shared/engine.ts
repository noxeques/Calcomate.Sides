import { EMPTY_SETTINGS, SCHEMA } from './model';
import type {
  Content, ContentKind, ContentStatus, Currency, Donation, DonationFilter, HistoryEntry,
  MutationResult, Operation, Page, PrivateLog, PublicSnapshot, RecordMeta, Settings, Summary, Totals,
} from './model';
import {
  AppError, contentFields, donationFields, filterFields, identifier, object, requireValue, settingsFields,
} from './validation';

export const MAX_IMPORT = 100;
const MAX_PUBLISHED = 100;
const PAGE_SIZE = 12;
type Stream = keyof PrivateLog;
export interface Repository {
  read(stream: Stream): Operation[];
  append(stream: Stream, operation: Operation): void;
  readPublic(): PublicSnapshot | null;
  replacePublic(snapshot: PublicSnapshot): void;
}
export interface Runtime {
  organizationId: string;
  repository: Repository;
  digest: (data: string) => string;
  now: () => string;
}

export function authorize(active: string, effective: string, allowList: string): string {
  const email = active.trim().toLowerCase();
  const allowed = allowList.split(/[,\n]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  requireValue(email && email === effective.trim().toLowerCase() && allowed.includes(email),
    'Yönetim paneline erişim reddedildi. Yetkili Google hesabınızı kullanın.', 'AUTH');
  return email;
}

function collect<T extends Content | Settings | Donation>(operations: Operation[]): T[] {
  const current = new Map<string, T>();
  for (const operation of operations) {
    for (const record of operation.records) current.set(record.id, record as T);
  }
  return [...current.values()];
}
const epoch = '1970-01-01T00:00:00.000Z';
function currentSettings(log: Operation[]): Settings {
  return collect<Settings>(log.filter((entry) => entry.action === 'theme.save'))[0] ??
    { ...EMPTY_SETTINGS, id: 'settings-main', status: 'active', version: 0, createdAt: epoch, updatedAt: epoch };
}
function currentContent(log: Operation[]): Content[] {
  return collect<Content>(log.filter((entry) => entry.action !== 'theme.save'));
}
function latestPublication(log: Operation[]): Operation | undefined {
  for (let index = log.length - 1; index >= 0; index--) {
    if (log[index].publicVersion !== undefined) return log[index];
  }
  return undefined;
}
function createSnapshot(log: Operation[], organizationId: string): PublicSnapshot | null {
  const publication = latestPublication(log);
  if (!publication?.publicVersion) return null;
  const items = currentContent(log).flatMap((item) => item.status === 'published' && item.published
    ? [{ ...contentFields(item.published.fields), id: item.id, publishedAt: item.published.at }] : []);
  requireValue(items.length <= MAX_PUBLISHED, 'En fazla 100 içerik aynı anda yayımlanabilir. Önce eski bir içeriği arşivleyin.');
  return {
    schema: SCHEMA, organizationId, version: publication.publicVersion, publishedAt: publication.at,
    settings: settingsFields(currentSettings(log)), items,
  };
}
function paginate<T>(items: T[], value: unknown): Page<T> {
  const page = value ?? 1;
  requireValue(typeof page === 'number' && Number.isSafeInteger(page) && page >= 1, 'Sayfa numarası geçersiz.');
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  return { items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages, total: items.length };
}
function selectDonations(rows: Donation[], filter: DonationFilter): Donation[] {
  const search = filter.search?.toLocaleLowerCase('tr-TR');
  return rows.filter((item) =>
    (!filter.from || item.date >= filter.from) && (!filter.to || item.date <= filter.to) &&
    (!filter.campaign || item.campaign === filter.campaign) &&
    (!search || [item.donor, item.reference, item.campaign, item.note, item.id].some((field) =>
      field.toLocaleLowerCase('tr-TR').includes(search))))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
function addTotal(totals: Map<Currency, Totals>, row: Donation): void {
  const old = totals.get(row.currency);
  const amountMinor = (old?.amountMinor ?? 0) + row.amountMinor;
  requireValue(Number.isSafeInteger(amountMinor), 'Toplam hesaplama sınırını aşıyor.', 'LIMIT');
  totals.set(row.currency, { currency: row.currency, count: (old?.count ?? 0) + 1, amountMinor });
}
function orderedTotals(totals: Map<Currency, Totals>): Totals[] {
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
function overview(contentLog: Operation[], rows: Donation[], filter: DonationFilter): Summary {
  const content = {
    post: { draft: 0, published: 0, archived: 0 },
    event: { draft: 0, published: 0, archived: 0 },
  };
  for (const item of currentContent(contentLog)) content[item.kind][item.status]++;
  const campaigns = new Map<string, Map<Currency, Totals>>();
  const totals = new Map<Currency, Totals>();
  for (const row of selectDonations(rows, filter)) {
    if (row.status === 'cancelled') continue;
    const byCurrency = campaigns.get(row.campaign) ?? new Map<Currency, Totals>();
    addTotal(totals, row);
    addTotal(byCurrency, row);
    campaigns.set(row.campaign, byCurrency);
  }
  return {
    content, totals: orderedTotals(totals),
    campaigns: [...campaigns].sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([campaign, items]) => ({ campaign, totals: orderedTotals(items) })),
    campaignOptions: [...new Set(rows.map((row) => row.campaign).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    publicVersion: latestPublication(contentLog)?.publicVersion ?? 0,
  };
}
function versioned<T extends RecordMeta>(records: T[], id: unknown, version: unknown): T {
  const record = records.find((item) => item.id === identifier(id));
  requireValue(record, 'Kayıt bulunamadı.', 'NOT_FOUND');
  requireValue(record.version === version, 'Kayıt başka bir işlemde değişti. Sayfayı yenileyip güncel kaydı açın.', 'CONFLICT');
  return record;
}
function meta(id: string, at: string, old?: RecordMeta): RecordMeta {
  return { id, version: old ? old.version + 1 : 1, createdAt: old?.version ? old.createdAt : at, updatedAt: at };
}
function stable(value: unknown, depth = 0): string {
  requireValue(depth <= 12, 'İstek yapısı çok derin.');
  if (Array.isArray(value)) return '[' + value.map((item) => stable(item, depth + 1)).join(',') + ']';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return '{' + entries.map(([key, item]) => JSON.stringify(key) + ':' + stable(item, depth + 1)).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

const CONTENT_ACTIONS = ['content.save', 'content.publish', 'content.archive', 'theme.save'];
const DONATION_ACTIONS = ['donation.save', 'donation.cancel', 'donation.import'];
function makeOperation(stream: Stream, log: Operation[], x: Record<string, unknown>, actor: string, requestId: string, digest: string, at: string): Operation {
  const id = 'r-' + requestId;
  const records: Operation['records'] = [];
  let publicVersion: number | undefined;
  const nextVersion = () => (latestPublication(log)?.publicVersion ?? 0) + 1;
  if (stream === 'content') {
    const content = currentContent(log);
    if (x.action === 'content.save') {
      const old = x.id === undefined ? undefined : versioned(content, x.id, x.version);
      const fields = contentFields(x.fields);
      requireValue(!old || fields.kind === old.kind, 'Kayıt türü sonradan değiştirilemez.');
      records.push({ ...fields, ...meta(old?.id ?? id, at, old), status: old?.status === 'published' ? 'published' : 'draft', published: old?.published ?? null });
    } else if (x.action === 'theme.save') {
      const old = currentSettings(log);
      requireValue(old.version === x.version, 'Tema ayarları değişti. Güncel ayarları yeniden açın.', 'CONFLICT');
      records.push({ ...settingsFields(x.fields), ...meta(old.id, at, old), status: 'active' });
      publicVersion = nextVersion();
    } else {
      const old = versioned(content, x.id, x.version);
      if (x.action === 'content.publish') {
        requireValue(old.kind !== 'event' || (old.eventDate && old.location && old.body), 'Yayımlamak için etkinlik tarihi, yeri ve açıklaması gerekli.');
        records.push({ ...old, ...meta(old.id, at, old), status: 'published', published: { fields: contentFields(old), at, version: old.version + 1 } });
        publicVersion = nextVersion();
      } else {
        requireValue(old.status !== 'archived', 'İçerik zaten arşivlenmiş.');
        records.push({ ...old, ...meta(old.id, at, old), status: 'archived', published: null });
        if (old.status === 'published') publicVersion = nextVersion();
      }
    }
  } else if (x.action === 'donation.import') {
    requireValue(Array.isArray(x.rows) && x.rows.length > 0 && x.rows.length <= MAX_IMPORT, 'Bir grupta 1–100 geçerli bağış satırı gerekli.');
    x.rows.forEach((row, index) => {
      try {
        records.push({ ...donationFields(row), ...meta(id + '-' + (index + 1), at), status: 'active' });
      } catch (error) {
        if (error instanceof AppError) throw new AppError(error.code, 'Grup satırı ' + (index + 1) + ' · ' + error.message);
        throw error;
      }
    });
  } else {
    const donations = collect<Donation>(log);
    if (x.action === 'donation.save') {
      const old = x.id === undefined ? undefined : versioned(donations, x.id, x.version);
      requireValue(old?.status !== 'cancelled', 'İptal edilmiş kayıt düzenlenemez.');
      records.push({ ...donationFields(x.fields), ...meta(old?.id ?? id, at, old), status: 'active' });
    } else {
      const old = versioned(donations, x.id, x.version);
      requireValue(old.status !== 'cancelled', 'Bağış zaten iptal edilmiş.');
      records.push({ ...old, ...meta(old.id, at, old), status: 'cancelled' });
    }
  }
  return {
    requestId, action: x.action as Operation['action'], actor, at, digest, records,
    count: records.length, ids: records.map((record) => record.id),
    ...(publicVersion === undefined ? {} : { publicVersion }),
  };
}

function syncPublication(runtime: Runtime, snapshot: PublicSnapshot | null): void {
  if (!snapshot) return;
  try {
    const current = runtime.repository.readPublic();
    requireValue(!current || (current.organizationId === runtime.organizationId && current.version <= snapshot.version),
      'Yayın kopyası kuruluş veya sürüm açısından uyuşmuyor.', 'PUBLIC');
    if (current?.version !== snapshot.version) runtime.repository.replacePublic(snapshot);
  } catch {
    throw new AppError('PUBLIC_PENDING', 'Özel kayıt işlendi. Kamuya açık kopya doğrulanamadı. Yönetim bölümünden yayını yeniden eşitleyin.');
  }
}

// The caller holds an organization-local write lock for this entire operation.
export function mutate(runtime: Runtime, input: unknown, actor: string): MutationResult {
  const x = object(input);
  const requestId = identifier(x.requestId);
  requireValue(requestId.length <= 64, 'İstek kimliği en fazla 64 karakter olmalı.');
  const repository = runtime.repository;
  if (x.action === 'publication.retry') {
    const snapshot = createSnapshot(repository.read('content'), runtime.organizationId);
    syncPublication(runtime, snapshot);
    return { requestId, ids: [], count: 0, repeated: false, publicVersion: snapshot?.version ?? 0 };
  }
  requireValue(typeof x.action === 'string' && [...CONTENT_ACTIONS, ...DONATION_ACTIONS].includes(x.action), 'İşlem geçersiz.');
  const stream = CONTENT_ACTIONS.includes(x.action) ? 'content' : 'donations';
  const serialized = stable(x);
  requireValue(serialized.length <= 250_000, 'İstek boyutu sınırı aşıldı.', 'LIMIT');
  const digest = runtime.digest(serialized);
  const log = repository.read(stream);
  const other = repository.read(stream === 'content' ? 'donations' : 'content');
  requireValue(!other.some((item) => item.requestId === requestId), 'İstek kimliği başka işlemde kullanılmış.', 'IDEMPOTENCY');
  const previous = log.find((entry) => entry.requestId === requestId);
  if (previous) {
    requireValue(previous.digest === digest && previous.actor === actor, 'İstek kimliği başka veri veya kullanıcıyla kullanılmış.', 'IDEMPOTENCY');
    if (previous.publicVersion) syncPublication(runtime, createSnapshot(log, runtime.organizationId));
    return { requestId, ids: previous.ids, count: previous.count, repeated: true, publicVersion: latestPublication(stream === 'content' ? log : other)?.publicVersion ?? 0 };
  }
  const operation = makeOperation(stream, log, x, actor, requestId, digest, runtime.now());
  const snapshot = operation.publicVersion ? createSnapshot([...log, operation], runtime.organizationId) : null;
  repository.append(stream, operation);
  syncPublication(runtime, snapshot);
  return { requestId, ids: operation.ids, count: operation.count, repeated: false, publicVersion: snapshot?.version ?? latestPublication(stream === 'content' ? log : other)?.publicVersion ?? 0 };
}

export function query(runtime: Runtime, name: string, params?: unknown): unknown {
  const repository = runtime.repository;
  switch (name) {
    case 'overview':
      return overview(repository.read('content'), collect<Donation>(repository.read('donations')), filterFields(params));
    case 'contents': {
      const filter = object(params ?? {});
      requireValue(!filter.kind || ['post', 'event'].includes(filter.kind as ContentKind), 'İçerik türü geçersiz.');
      requireValue(!filter.status || ['draft', 'published', 'archived'].includes(filter.status as ContentStatus), 'İçerik durumu geçersiz.');
      const search = filterFields({ search: filter.search }).search?.toLocaleLowerCase('tr-TR');
      const rows = currentContent(repository.read('content')).filter((item) => (!filter.kind || item.kind === filter.kind) &&
        (!filter.status || item.status === filter.status) && (!search || item.title.toLocaleLowerCase('tr-TR').includes(search)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return paginate(rows, filter.page);
    }
    case 'theme':
      return currentSettings(repository.read('content'));
    case 'donations':
      return paginate(selectDonations(collect<Donation>(repository.read('donations')), filterFields(params)), object(params ?? {}).page);
    case 'history': {
      const entries: HistoryEntry[] = [...repository.read('content'), ...repository.read('donations')]
        .sort((a, b) => b.at.localeCompare(a.at) || b.requestId.localeCompare(a.requestId))
        .map(({ requestId, action, actor, at, count, ids, publicVersion }) => ({
          requestId, action, actor, at, count, ids, ...(publicVersion === undefined ? {} : { publicVersion }),
        }));
      return paginate(entries, params);
    }
    case 'publication': {
      const target = latestPublication(repository.read('content'))?.publicVersion ?? 0;
      let current: number | null = null;
      try {
        const snapshot = repository.readPublic();
        current = snapshot ? (snapshot.organizationId === runtime.organizationId ? snapshot.version : null) : 0;
      } catch { /* Management reports an unavailable publication separately from an empty one. */ }
      return { target, current };
    }
    case 'exportData':
      return { schema: SCHEMA, organizationId: runtime.organizationId, exportedAt: runtime.now(), log: { content: repository.read('content'), donations: repository.read('donations') } };
    case 'exportDonations':
      return selectDonations(collect<Donation>(repository.read('donations')), filterFields(params));
    default:
      throw new AppError('VALIDATION', 'Sorgu geçersiz.');
  }
}
