import { CURRENCIES, METHODS, PAGE_NAMES, SAMPLE_IMAGES, SCHEMA } from './model';
import type { ContentFields, Currency, DonationFields, DonationFilter, MenuPage, PublicSnapshot, SettingsFields } from './model';

export class AppError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function requireValue(condition: unknown, message: string, code = 'VALIDATION'): asserts condition {
  if (!condition) throw new AppError(code, message);
}
export function object(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'Geçersiz veri yapısı.');
  return value as Record<string, unknown>;
}
export function has<T extends object>(target: T, key: unknown): key is Extract<keyof T, string> {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key);
}
function plain(value: unknown, label: string, max: number, required = false): string {
  requireValue(typeof value === 'string', label + ' metin olmalı.');
  const clean = value.trim();
  requireValue((!required || clean.length > 0) && clean.length <= max, label + ' için geçersiz uzunluk (en fazla ' + max + ').');
  requireValue(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(clean), label + ' geçersiz karakter içeriyor.');
  requireValue(!/<\s*\/?\s*[a-z!][^>]*>/iu.test(clean), label + ' düz metin olmalı. HTML etiketi kullanmayın.');
  return clean;
}
export function isHttpsUrl(value: string): boolean {
  // Apps Script V8 does not expose the browser URL constructor.
  return /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?(?::443)?(?:[/?#][^\s<>"'\\]*)?$/iu.test(value);
}
function link(value: unknown, label: string, allowSample = false): string {
  const clean = plain(value, label, 500);
  requireValue(!clean || (allowSample && has(SAMPLE_IMAGES, clean)) || isHttpsUrl(clean), label + ' geçerli bir HTTPS adresi olmalı.');
  return clean;
}
export function dateValue(value: unknown, label = 'Tarih'): string {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), label + ' YYYY-AA-GG biçiminde olmalı.');
  const date = new Date(value + 'T00:00:00.000Z');
  requireValue(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01', label + ' geçersiz.');
  return value;
}
export function identifier(value: unknown): string {
  requireValue(typeof value === 'string' && /^[a-z0-9][a-z0-9-]{7,79}$/.test(value), 'Geçersiz kayıt veya istek kimliği.');
  return value;
}
export function organizationId(value: unknown): string {
  requireValue(typeof value === 'string' && /^[a-z][a-z0-9-]{2,39}$/.test(value), 'Kuruluş anahtarı geçersiz.', 'CONFIG');
  return value;
}
export function contentFields(input: unknown): ContentFields {
  const x = object(input);
  requireValue(x.kind === 'event' || x.kind === 'post', 'İçerik türü geçersiz.');
  return {
    kind: x.kind,
    title: plain(x.title, 'Başlık', 120, true),
    summary: plain(x.summary, 'Özet', 320),
    body: plain(x.body, 'Açıklama', 4000),
    image: link(x.image, 'Görsel', true),
    eventDate: x.kind === 'event' && x.eventDate ? dateValue(x.eventDate, 'Etkinlik tarihi') : '',
    location: x.kind === 'event' ? plain(x.location, 'Etkinlik yeri', 180) : '',
  };
}
function hex(value: unknown): string {
  requireValue(typeof value === 'string' && /^#[\da-f]{6}$/i.test(value), 'Renk #RRGGBB biçiminde olmalı.');
  return value.toLowerCase();
}
export function settingsFields(input: unknown): SettingsFields {
  const x = object(input);
  requireValue(x.theme === 'coast' || x.theme === 'forest', 'Tema geçersiz.');
  requireValue(Array.isArray(x.menu) && x.menu.length <= 5 && x.menu.includes('home') &&
    x.menu.every((item) => has(PAGE_NAMES, item)) && new Set(x.menu).size === x.menu.length, 'Menüde ana sayfa ve benzersiz sayfalar bulunmalı.');
  requireValue(Array.isArray(x.socials) && x.socials.length <= 6, 'En fazla altı sosyal bağlantı eklenebilir.');
  const email = plain(x.email, 'E-posta', 160);
  requireValue(!email || /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email), 'E-posta adresi geçersiz.');
  const phone = plain(x.phone, 'Telefon', 40);
  requireValue(!phone || /^\+?[0-9 ()-]{5,40}$/.test(phone), 'Telefon numarası geçersiz.');
  return {
    organizationName: plain(x.organizationName, 'Kuruluş adı', 90, true),
    tagline: plain(x.tagline, 'Ana sayfa başlığı', 110),
    introduction: plain(x.introduction, 'Ana sayfa açıklaması', 550),
    about: plain(x.about, 'Hakkımızda', 4000),
    theme: x.theme, primary: hex(x.primary), accent: hex(x.accent), logo: link(x.logo, 'Logo'),
    menu: x.menu as MenuPage[], email, phone, address: plain(x.address, 'Adres', 400),
    socials: x.socials.map((item) => {
      const social = object(item);
      const url = link(social.url, 'Sosyal bağlantı');
      requireValue(url, 'Sosyal bağlantı adresi gerekli.');
      return { label: plain(social.label, 'Bağlantı adı', 40, true), url };
    }),
    terms: plain(x.terms, 'Kullanım koşulları', 4000), privacy: plain(x.privacy, 'Gizlilik politikası', 4000),
    notice: plain(x.notice, 'Aydınlatma metni', 4000), support: link(x.support, 'Destek bağlantısı'),
  };
}
export const MAX_MINOR = 100_000_000_000;
export function donationFields(input: unknown): DonationFields {
  const x = object(input);
  requireValue(has(CURRENCIES, x.currency), 'Desteklenmeyen para birimi.');
  requireValue(has(METHODS, x.method), 'Ödeme yöntemi geçersiz.');
  const amountMinor = x.amountMinor;
  requireValue(typeof amountMinor === 'number' && Number.isSafeInteger(amountMinor) &&
    amountMinor > 0 && amountMinor <= MAX_MINOR, 'Tutar sıfırdan büyük ve izin verilen aralıkta olmalı.');
  return {
    date: dateValue(x.date), amountMinor, currency: x.currency, method: x.method,
    campaign: plain(x.campaign, 'Kampanya', 100),
    donor: plain(x.donor, 'Bağışçı', 120),
    reference: plain(x.reference, 'Referans', 100),
    note: plain(x.note, 'Not', 500),
  };
}
export function parseAmount(value: string, currency: Currency, decimal: ',' | '.'): number {
  requireValue(has(CURRENCIES, currency), 'Desteklenmeyen para birimi.');
  requireValue(decimal === ',' || decimal === '.', 'Ondalık ayırıcı geçersiz.');
  const clean = value.trim();
  const [integer, fraction, ...extra] = clean.split(decimal);
  const digits = CURRENCIES[currency];
  requireValue(/^\d{1,12}$/.test(integer) && !extra.length &&
    (fraction === undefined || (digits > 0 && /^\d+$/.test(fraction) && fraction.length <= digits)),
    'Tutar biçimi geçersiz. Binlik ayırıcı kullanmayın. Ondalık ayırıcı ' + decimal + ' olmalı.');
  const amount = Number(integer) * 10 ** digits + Number((fraction ?? '').padEnd(digits, '0'));
  requireValue(Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_MINOR, 'Tutar sıfırdan büyük ve izin verilen aralıkta olmalı.');
  return amount;
}
export function filterFields(input: unknown): DonationFilter {
  const x = object(input ?? {});
  const from = x.from ? dateValue(x.from, 'Başlangıç tarihi') : '';
  const to = x.to ? dateValue(x.to, 'Bitiş tarihi') : '';
  requireValue(!from || !to || from <= to, 'Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  return { from, to, campaign: plain(x.campaign ?? '', 'Kampanya', 100), search: plain(x.search ?? '', 'Arama', 180) };
}
function timestamp(value: unknown): string {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)), 'Yayın zamanı geçersiz.', 'PUBLIC');
  return value;
}
export function publicSnapshot(input: unknown): PublicSnapshot {
  const x = object(input);
  requireValue(x.schema === SCHEMA && typeof x.version === 'number' && Number.isSafeInteger(x.version) && x.version > 0 &&
    Array.isArray(x.items) && x.items.length <= 100, 'Yayın kopyasının biçimi geçersiz.', 'PUBLIC');
  return {
    schema: SCHEMA, organizationId: organizationId(x.organizationId), version: x.version, publishedAt: timestamp(x.publishedAt),
    settings: settingsFields(x.settings),
    items: x.items.map((item) => {
      const record = object(item);
      return { ...contentFields(record), id: identifier(record.id), publishedAt: timestamp(record.publishedAt) };
    }),
  };
}
