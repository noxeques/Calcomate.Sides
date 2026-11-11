import { authorize, mutate, query } from '../../shared/engine';
import type { Runtime } from '../../shared/engine';
import { AppError, organizationId, requireValue } from '../../shared/validation';
import { googleRepository } from './repository';

declare const Session: { getActiveUser(): { getEmail(): string }; getEffectiveUser(): { getEmail(): string } };
declare const PropertiesService: { getScriptProperties(): { getProperty(key: string): string | null } };
declare const HtmlService: { createHtmlOutput(content: string): HtmlOutput; createHtmlOutputFromFile(name: string): HtmlOutput };
interface HtmlOutput { setTitle(title: string): HtmlOutput; addMetaTag(name: string, value: string): HtmlOutput }
declare const LockService: { getScriptLock(): { tryLock(ms: number): boolean; releaseLock(): void } };
declare const Utilities: { computeDigest(algorithm: unknown, value: string, charset: unknown): number[];
  DigestAlgorithm: { SHA_256: unknown }; Charset: { UTF_8: unknown } };

function checkAdmin(): string {
  return authorize(Session.getActiveUser().getEmail(), Session.getEffectiveUser().getEmail(),
    PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') ?? '');
}
function context(): Runtime {
  const props = PropertiesService.getScriptProperties();
  const org = organizationId(props.getProperty('ORGANIZATION_ID'));
  const ids = {
    content: props.getProperty('CONTENT_SHEET_ID') ?? '',
    donations: props.getProperty('DONATIONS_SHEET_ID') ?? '',
    public: props.getProperty('PUBLIC_SHEET_ID') ?? '',
  };
  const values = Object.values(ids);
  requireValue(values.every((id) => /^[a-z0-9_-]{20,}$/i.test(id)) && new Set(values).size === 3,
    'Kurulum eksik. Üç farklı Sheets dosyası tanımlayın.', 'CONFIG');
  return {
    organizationId: org, repository: googleRepository(org, ids), now: () => new Date().toISOString(),
    digest: (data) => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8)
      .map((byte) => (byte & 255).toString(16).padStart(2, '0')).join(''),
  };
}
function run(operation: (actor: string, runtime: Runtime) => unknown) {
  try {
    const actor = checkAdmin();
    return { ok: true, data: operation(actor, context()) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: 'STORAGE', message: 'Sheets işlemine erişilemedi. Dosya izinlerini, sekmeleri ve yapılandırmayı kontrol edin.' };
  }
}
export function doGet(): HtmlOutput {
  try {
    checkAdmin();
    return HtmlService.createHtmlOutputFromFile('Index').setTitle('CalcomateSides · Yönetim')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch {
    return HtmlService.createHtmlOutput('<main lang="tr"><h1>CalcomateSides</h1><p>Yönetim paneline erişim reddedildi. Yetkili Google hesabınızla tekrar açın.</p><p>CalcomateSides, Calcolit firmasının ürünüdür.</p><footer>© 2026 Calcolit. CalcomateSides servis yazılımı Calcolit firmasına aittir. Tüm hakları saklıdır.</footer></main>')
      .setTitle('CalcomateSides · Erişim');
  }
}
function locked<T>(work: () => T): T {
  const lock = LockService.getScriptLock();
  requireValue(lock.tryLock(12_000), 'Başka bir kayıt işlemi sürüyor. Aynı işlemi yeniden deneyin.', 'BUSY');
  try { return work(); } finally { lock.releaseLock(); }
}
export function adminQuery(name: string, params: unknown) {
  return run((_, runtime) => name === 'exportData' ? locked(() => query(runtime, name, params)) : query(runtime, name, params));
}
export function adminMutate(input: unknown) {
  return run((actor, runtime) => locked(() => mutate(runtime, input, actor)));
}
