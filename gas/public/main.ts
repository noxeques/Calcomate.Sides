import { AppError, organizationId, publicSnapshot, requireValue } from '../../shared/validation';
import { decode, TAB, verifyMarker, LAST_COLUMN } from '../codec';

declare const PropertiesService: { getScriptProperties(): { getProperty(key: string): string | null } };
declare const Sheets: {
  Spreadsheets: {
    Values: { get(id: string, range: string, options: { valueRenderOption: string }): { values?: unknown[][] } };
  };
};
declare const ContentService: { createTextOutput(text: string): { setMimeType(type: unknown): unknown }; MimeType: { JSON: unknown } };

// Only doGet is exported. Request parameters never select a data source or a callback.
export function doGet(): unknown {
  let reply: unknown;
  try {
    const props = PropertiesService.getScriptProperties();
    const org = organizationId(props.getProperty('ORGANIZATION_ID'));
    const id = props.getProperty('PUBLIC_SHEET_ID') ?? '';
    requireValue(/^[a-z0-9_-]{20,}$/i.test(id), 'Yayın kaynağı yapılandırılmamış.', 'CONFIG');
    const rows = Sheets.Spreadsheets.Values.get(id, TAB.public + '!A1:' + LAST_COLUMN + '2',
      { valueRenderOption: 'UNFORMATTED_VALUE' }).values ?? [];
    const [header, row = []] = rows;
    verifyMarker(header?.[0], org, 'public');
    requireValue(row.length, 'Henüz bir yayın kopyası oluşturulmadı.', 'EMPTY');
    const data = publicSnapshot(decode(row));
    requireValue(data.organizationId === org, 'Yayın kaynağı kuruluşla eşleşmiyor.', 'CONFIG');
    reply = { ok: true, data };
  } catch (error) {
    reply = { ok: false, code: error instanceof AppError && error.code === 'EMPTY' ? 'EMPTY' : 'PUBLIC',
      message: error instanceof AppError && error.code === 'EMPTY'
        ? 'Henüz yayımlanmış bir site yok.' : 'Yayın kaynağına şu anda erişilemiyor.' };
  }
  return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
}
