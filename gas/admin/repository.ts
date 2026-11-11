import type { Operation, PublicSnapshot } from '../../shared/model';
import type { Repository } from '../../shared/engine';
import { AppError, publicSnapshot, requireValue } from '../../shared/validation';
import { decode, encode, LAST_COLUMN, TAB, verifyMarker, WIDTH } from '../codec';
import type { Store } from '../codec';

interface SheetTarget { id: string; sheetId: number }
interface SheetGateway {
  Values: { get(id: string, range: string, options: Record<string, string>): { values?: unknown[][] } };
  get(id: string, options: Record<string, string>): { sheets?: { properties: { title: string; sheetId: number; gridProperties: { columnCount: number; rowCount: number } } }[] };
  batchUpdate(body: { requests: unknown[] }, id: string): unknown;
}
declare const Sheets: { Spreadsheets: SheetGateway };

function cells(row: string[]) {
  return { values: row.map((part) => ({ userEnteredValue: { stringValue: part } })) };
}

export function googleRepository(org: string, ids: Record<Store, string>): Repository {
  const targets = new Map<Store, SheetTarget>();
  const read = (store: Store, all: boolean) => {
    const lastRow = all ? '' : '2';
    const range = TAB[store] + '!A1:' + LAST_COLUMN + lastRow;
    const rows = Sheets.Spreadsheets.Values.get(ids[store], range, { valueRenderOption: 'UNFORMATTED_VALUE' }).values ?? [];
    verifyMarker(rows[0]?.[0], org, store);
    return rows.slice(1);
  };
  function target(store: Store): SheetTarget {
    const cached = targets.get(store);
    if (cached) return cached;
    const id = ids[store];
    const metadata = Sheets.Spreadsheets.get(id, { fields: 'sheets.properties(title,sheetId,gridProperties(columnCount,rowCount))' });
    const sheet = metadata.sheets?.find((item) => item.properties.title === TAB[store])?.properties;
    requireValue(sheet && sheet.gridProperties.columnCount >= WIDTH && sheet.gridProperties.rowCount >= 2,
      TAB[store] + ' sekmesinde en az 64 sütun ve 2 satır gerekli.', 'CONFIG');
    const value = { id, sheetId: sheet.sheetId };
    targets.set(store, value);
    return value;
  }
  function write(store: Store, requests: (sheetId: number) => unknown[]): void {
    const { id, sheetId } = target(store);
    try {
      Sheets.Spreadsheets.batchUpdate({ requests: requests(sheetId) }, id);
    } catch {
      throw new AppError('WRITE_UNKNOWN', 'Sheets yazımı doğrulanamadı. Aynı işlemi yeniden deneyin.');
    }
  }
  return {
    read: (store) => read(store, true).map((row) => {
      const operation = decode<Operation>(row);
      requireValue(operation && typeof operation.requestId === 'string' && Array.isArray(operation.records) &&
        Array.isArray(operation.ids) && operation.count === operation.records.length &&
        (store === 'content' ? /^(content\.|theme\.)/ : /^donation\./).test(operation.action),
      'İşlem günlüğü bozuk. Yedek ve sekme yapısını kontrol edin.', 'STORAGE');
      return operation;
    }),
    append: (store, operation) => {
      const values = cells(encode(operation));
      write(store, (sheetId) => [{ appendCells: { sheetId, rows: [values], fields: 'userEnteredValue' } }]);
    },
    readPublic: () => {
      const row = read('public', false)[0];
      return row?.length ? publicSnapshot(decode(row)) : null;
    },
    replacePublic: (snapshot) => {
      const values = cells(encode(snapshot));
      write('public', (sheetId) => [{ updateCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: WIDTH },
        rows: [values], fields: 'userEnteredValue',
      } }]);
    },
  };
}
