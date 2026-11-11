import { MAX_IMPORT } from './engine';
import { CURRENCIES, METHODS } from './model';
import type { Currency, Donation, DonationFields, Method } from './model';
import { AppError, donationFields, has, parseAmount, requireValue } from './validation';

export const CSV_FIELDS = {
  date: 'Tarih', amount: 'Tutar', currency: 'Para birimi', method: 'Ödeme yöntemi',
  campaign: 'Kampanya', donor: 'Bağışçı', reference: 'Referans', note: 'Not',
} as const;
export type CsvField = keyof typeof CSV_FIELDS;
export type CsvMapping = Partial<Record<CsvField, number>>;
export type Delimiter = ';' | ',' | '\t';
export interface CsvRow { line: number; cells: string[] }
export interface CsvTable { headers: string[]; rows: CsvRow[] }
export const CSV_MAX_BYTES = 512_000;

export function parseCsv(source: string, delimiter: Delimiter): CsvTable {
  requireValue(delimiter === ';' || delimiter === ',' || delimiter === '\t', 'Sütun ayırıcı geçersiz.');
  requireValue(source.length <= CSV_MAX_BYTES, 'CSV dosyası en fazla 512 KB olabilir.');
  const text = source.replace(/^\uFEFF/, '');
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let state: 'start' | 'text' | 'quoted' | 'closed' = 'start';
  let line = 1;
  let rowLine = 1;
  const endField = () => {
    cells.push(field);
    requireValue(cells.length <= 40, 'CSV en fazla 40 sütun içerebilir.');
    field = '';
    state = 'start';
  };
  const endRow = () => {
    endField();
    if (cells.some((cell) => cell.trim())) rows.push({ line: rowLine, cells });
    requireValue(rows.length <= MAX_IMPORT + 1, 'CSV en fazla 100 veri satırı içerebilir.');
    cells = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const newline = char === '\r' || char === '\n';
    if (newline && char === '\r' && text[index + 1] === '\n') index++;
    if (state === 'quoted') {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; } else state = 'closed';
      } else {
        field += newline ? '\n' : char;
        if (newline) line++;
      }
    } else if (newline) {
      endRow();
      rowLine = ++line;
    } else if (char === delimiter) {
      endField();
    } else if (char === '"' && state === 'start') {
      state = 'quoted';
    } else {
      requireValue(state !== 'closed' && char !== '"', line + '. satırda hatalı tırnak kullanımı.');
      field += char;
      state = 'text';
    }
  }
  requireValue(state !== 'quoted', rowLine + '. satırda kapanmamış tırnak.');
  if (cells.length || field || state === 'closed') endRow();
  const header = rows.shift();
  requireValue(header && header.cells.every((item) => item.trim()), 'İlk satırda her sütun için bir başlık gerekli.');
  requireValue(rows.length > 0, 'İçe aktarılacak satır bulunamadı.');
  return { headers: header.cells.map((item) => item.trim()), rows };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s_-]+/g, ' ');
}
export function suggestMapping(headers: string[]): CsvMapping {
  const alternatives: Record<CsvField, string[]> = {
    date: ['date'], amount: ['amount'], currency: ['currency', 'doviz'], method: ['method', 'payment method', 'odeme'],
    campaign: ['campaign'], donor: ['donor', 'bagisci adi'], reference: ['reference', 'ref'], note: ['note', 'aciklama'],
  };
  const map: CsvMapping = {};
  const normalizedHeaders = headers.map(normalized);
  for (const key of Object.keys(CSV_FIELDS) as CsvField[]) {
    const at = normalizedHeaders.findIndex((header) => header === normalized(CSV_FIELDS[key]) || alternatives[key].includes(header));
    if (at >= 0) map[key] = at;
  }
  return map;
}
const methodAliases: Record<string, Method> = { havale: 'transfer', eft: 'transfer', kart: 'card' };
function parseMethod(value: string): Method {
  const key = normalized(value);
  if (has(METHODS, key)) return key;
  if (has(methodAliases, key)) return methodAliases[key];
  const match = (Object.keys(METHODS) as Method[]).find((method) => normalized(METHODS[method]) === key);
  requireValue(match, 'Ödeme yöntemi geçersiz. Havale, nakit, kart veya diğer kullanın.');
  return match;
}
export function previewCsv(table: CsvTable, mapping: CsvMapping, decimal: ',' | '.', defaultCurrency: Currency) {
  const indexes = Object.values(mapping);
  requireValue(mapping.date !== undefined && mapping.amount !== undefined && mapping.method !== undefined,
    'Tarih, tutar ve ödeme yöntemi sütunlarını eşleştirin.');
  requireValue(indexes.every((index) => Number.isInteger(index) && index >= 0 && index < table.headers.length)
    && new Set(indexes).size === indexes.length, 'Her alan için ayrı ve geçerli bir sütun seçin.');
  return table.rows.map((row): { line: number; data?: DonationFields; error?: string } => {
    try {
      requireValue(row.cells.length === table.headers.length, 'Sütun sayısı başlıkla eşleşmiyor.');
      const get = (field: CsvField) => mapping[field] === undefined ? '' : row.cells[mapping[field]!].trim();
      const currency = get('currency').toUpperCase() || defaultCurrency;
      requireValue(has(CURRENCIES, currency), 'Desteklenmeyen para birimi.');
      const data = donationFields({
        date: get('date'), amountMinor: parseAmount(get('amount'), currency, decimal), currency,
        method: parseMethod(get('method')), campaign: get('campaign'), donor: get('donor'), reference: get('reference'), note: get('note'),
      });
      return { line: row.line, data };
    } catch (error) {
      return { line: row.line, error: error instanceof AppError ? error.message : 'Satır okunamadı.' };
    }
  });
}
export function decimalText(amountMinor: number, currency: Currency, delimiter = ','): string {
  const digits = CURRENCIES[currency];
  const padded = String(amountMinor).padStart(digits + 1, '0');
  return digits ? padded.slice(0, -digits) + delimiter + padded.slice(-digits) : padded;
}
export function csvCell(value: string): string {
  // Spreadsheet applications may evaluate a quoted CSV value after removing leading whitespace.
  const risky = /^[\s\u200B-\u200D\u2060\uFEFF]*[=+@\-\uFF1D\uFF0B\uFF20\uFF0D]|^[\t\r\n]/u.test(value);
  return '"' + (risky ? "'" : '') + value.replaceAll('"', '""') + '"';
}
export function exportCsv(rows: Donation[]): string {
  const fields = Object.values(CSV_FIELDS);
  const headers = [...fields, 'Durum', 'Kimlik'];
  const lines = rows.map((row) => [row.date, decimalText(row.amountMinor, row.currency), row.currency, METHODS[row.method],
    row.campaign, row.donor, row.reference, row.note, row.status === 'active' ? 'Etkin' : 'İptal', row.id]);
  return '\uFEFF' + [headers, ...lines].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
