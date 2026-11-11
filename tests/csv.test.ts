import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, exportCsv, parseCsv, previewCsv, suggestMapping } from '../shared/csv';
import { contentFields, isHttpsUrl, parseAmount } from '../shared/validation';
import { donation, event } from './fixtures';

test('para ayracı açık, binlik ve fazla basamak reddedilir', () => {
  assert.equal(parseAmount('1250,50', 'TRY', ','), 125050);
  assert.equal(parseAmount('1.234', 'KWD', '.'), 1234);
  assert.equal(parseAmount('100', 'JPY', '.'), 100);
  for (const value of ['1.250,50', '1,234', '1e2', '-12', '0', '1,', '5.00']) {
    assert.throws(() => parseAmount(value, 'TRY', ','));
  }
  assert.throws(() => parseAmount('1.1', 'JPY', '.'));
});

test('CSV BOM, CRLF, ayraç ve çok satırlı tırnakları korur; hataları satırda gösterir', () => {
  const csv = '\uFEFFTarih;Tutar;Ödeme yöntemi;Not\r\n2026-11-10;125,50;Havale;"bir; iki\r\nüç ""dört"""\r\n2026-02-30;1;Nakit;hata\r\n2026-11-10;1;Nakit\r\n';
  const table = parseCsv(csv, ';');
  const mapping = suggestMapping(table.headers);
  const preview = previewCsv(table, mapping, ',', 'TRY');
  assert.deepEqual(preview.map((item) => item.line), [2, 4, 5]);
  assert.equal(preview[0].data?.note, 'bir; iki\nüç "dört"');
  assert.equal(preview[0].data?.amountMinor, 12550);
  assert.match(preview[1].error ?? '', /geçersiz/);
  assert.match(preview[2].error ?? '', /Sütun sayısı/);
  assert.throws(() => parseCsv('A;B\n"eksik;x', ';'), /kapanmamış/);
  assert.throws(() => previewCsv(table, { ...mapping, amount: mapping.date }, ',', 'TRY'), /ayrı/);
});

test('CSV formülleri metne dönüştürür, HTML ve çalıştırılabilir adres reddedilir', () => {
  for (const value of ['=1+2', '  +123', '\t@SUM(1)', '\u200B-1', '＝CMD()']) assert.match(csvCell(value), /^"'/);
  const csv = exportCsv([{ ...donation, note: '=HYPERLINK("x")', id: 'test-donation', status: 'cancelled', version: 1, createdAt: '', updatedAt: '' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"İptal"'));
  for (const url of ['javascript:alert(1)', 'http://example.com/image.png', 'https://example.com@bad.example/file', 'https://example.com\\file']) {
    assert.equal(isHttpsUrl(url), false);
  }
  assert.equal(isHttpsUrl('https://example.com/images/file.jpg?size=2'), true);
  assert.throws(() => contentFields({ ...event, body: '<img src=x onerror=alert(1)>' }), /HTML/);
});
