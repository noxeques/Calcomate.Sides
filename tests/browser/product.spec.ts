import { expect, test } from '@playwright/test';
import { localDate } from '../../shared/model';

test('taslak ziyaretçide görünmez, yayın ve arşiv yenilemeyle görünür', async ({ page, context }) => {
  const name = 'Kent dayanışma buluşması';
  const publicPage = await context.newPage();
  await publicPage.goto('/#/etkinlikler');
  await expect(publicPage.getByRole('heading', { name: 'Etkinlikler', exact: true })).toBeVisible();
  await page.goto('/admin.html#icerik');
  await page.getByRole('button', { name: 'Yeni içerik' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('İçerik türü').selectOption('event');
  await dialog.getByLabel('Başlık').fill(name);
  await dialog.getByLabel('Etkinlik tarihi').fill('2030-11-10');
  await dialog.getByLabel('Etkinlik yeri').fill('İstanbul');
  await dialog.getByLabel('Açıklama').fill('Etkinliğin programı.');
  await dialog.getByRole('button', { name: 'Taslağı kaydet' }).click();
  await expect(page.getByText('Taslak kaydedildi.', { exact: true })).toBeVisible();
  await publicPage.getByRole('button', { name: 'Yenile' }).click();
  await expect(publicPage.getByRole('heading', { name })).toHaveCount(0);
  await page.getByRole('button', { name: name + ' yayımla' }).click();
  await dialog.getByRole('button', { name: 'Yayımla', exact: true }).click();
  await expect(page.getByText('İçerik yayımlandı. Ziyaretçi sitesinde yenileyerek görebilirsiniz.')).toBeVisible();
  await publicPage.getByRole('button', { name: 'Yenile' }).click();
  await publicPage.getByRole('heading', { name }).getByRole('link').click();
  await expect(publicPage.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(publicPage.getByText('Etkinliğin programı.')).toBeVisible();

  const other = await context.newPage();
  await other.goto('/?org=mavi-kopru#/etkinlikler');
  await expect(other.getByRole('heading', { name: 'Mahallede Okuma Buluşması' })).toBeVisible();
  await expect(other.getByRole('heading', { name })).toHaveCount(0);
  await page.getByRole('button', { name: name + ' arşivle' }).click();
  await dialog.getByRole('button', { name: 'Arşivle', exact: true }).click();
  await expect(page.getByText('İçerik arşivlendi.', { exact: true })).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible();
});

test('CSV satır hatası, eşleştirme, tekrar kilidi, bağış düzenleme, iptal ve dışa aktarma', async ({ page }) => {
  await page.goto('/admin.html#bagislar');
  await page.getByRole('button', { name: 'CSV içe aktar' }).click();
  const dialog = page.getByRole('dialog');
  const attach = async (amount: string) => dialog.getByLabel('UTF-8 CSV dosyası').setInputFiles({
    name: 'ornek.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Gün;Meblağ;Ödeme;Bağışçı;Referans\n' + localDate() + ';' + amount + ';nakit;Tarayıcı denemesi;TEST-REF\n'),
  });
  await attach('1.250,50');
  await dialog.getByRole('combobox', { name: 'Tarih *', exact: true }).selectOption('0');
  await dialog.getByRole('combobox', { name: 'Tutar *', exact: true }).selectOption('1');
  await expect(dialog.getByText('Tutar biçimi geçersiz.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'İçe aktar', exact: true })).toBeDisabled();

  await attach('1250,50');
  await dialog.getByRole('combobox', { name: 'Tarih *', exact: true }).selectOption('0');
  await dialog.getByRole('combobox', { name: 'Tutar *', exact: true }).selectOption('1');
  await expect(dialog.getByText('1 geçerli · 0 hatalı')).toBeVisible();
  await dialog.getByRole('button', { name: '1 bağışı içe aktar' }).click();
  await expect(dialog.getByText('1 bağış kaydedildi.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '1 bağışı içe aktar' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Tarayıcı denemesi bağışını düzenle' }).click();
  await dialog.getByLabel('Tutar').fill('1500,00');
  await dialog.getByRole('button', { name: 'Bağışı kaydet' }).click();
  await expect(page.getByText('Bağış kaydedildi.', { exact: true })).toBeVisible();
  const edited = page.getByRole('row').filter({ hasText: 'Tarayıcı denemesi' });
  await expect(edited.getByText(/1\.500,00/)).toBeVisible();

  await page.getByRole('button', { name: 'Tarayıcı denemesi bağışını iptal et' }).click();
  await dialog.getByRole('button', { name: 'Bağışı iptal et' }).click();
  await expect(edited.getByText('İptal', { exact: true })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV dışa aktar' }).click()]);
  expect(download.suggestedFilename()).toMatch(/calcomatesides-bagislar-.*\.csv/);
});

test('tema ve menü ziyaretçiye aktarılır, mobil klavye menüsü çalışır', async ({ page, context }) => {
  await page.goto('/admin.html#tema');
  await page.getByRole('button', { name: 'Orman', exact: true }).click();
  await page.getByLabel('Kuruluş adı', { exact: true }).fill('Örnek Kent Derneği');
  await page.getByRole('button', { name: 'Paylaşımlar kaldır', exact: true }).click();
  await page.getByRole('button', { name: 'Ayarları kaydet ve yayımla' }).click();
  await expect(page.getByText('Ayarlar kaydedildi ve yayımlandı.').first()).toBeVisible();
  const visitor = await context.newPage();
  await visitor.setViewportSize({ width: 375, height: 812 });
  await visitor.goto('/');
  await expect(visitor.getByRole('link', { name: 'Örnek Kent Derneği CalcomateSides' })).toBeVisible();
  const button = visitor.getByRole('button', { name: 'Menüyü aç' });
  await button.focus();
  await visitor.keyboard.press('Enter');
  const nav = visitor.getByRole('navigation', { name: 'Ana menü' });
  await expect(nav.getByRole('link', { name: 'Paylaşımlar' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Hakkımızda' }).click();
  await expect(visitor.getByRole('heading', { name: 'Hakkımızda' })).toBeVisible();
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test('üretim çıktıları kurulum eksikliğini gösterir ve demo açmaz', async ({ page }) => {
  await page.goto('http://127.0.0.1:48731/?org=yesil-iz');
  await expect(page.getByRole('alert')).toContainText('Kurulum eksik');
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
  await page.goto('http://127.0.0.1:48731/admin.html?org=yesil-iz');
  await expect(page.getByRole('alert')).toContainText('Apps Script web uygulamasının /exec adresinde açın');
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
});

test('elle bağış, filtre, işlem geçmişi ve JSON arşivi çalışır', async ({ page }) => {
  await page.goto('/admin.html#bagislar');
  await page.getByRole('button', { name: 'Yeni bağış' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tutar').fill('230,15');
  await dialog.getByLabel('Para birimi').selectOption('EUR');
  await dialog.getByLabel('Kampanya').fill('Park çalışması');
  await dialog.getByLabel('Referans').fill('EL-REF-001');
  await dialog.getByRole('button', { name: 'Bağışı kaydet' }).click();
  await expect(page.getByText('Bağış kaydedildi.', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Ara' }).fill('EL-REF-001');
  await page.getByRole('button', { name: 'Uygula', exact: true }).first().click();
  await expect(page.getByRole('row').filter({ hasText: 'EL-REF-001' })).toContainText('EUR');
  await expect(page.getByRole('row').filter({ hasText: 'DEMO-100' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Yönetim menüsü' }).getByRole('link', { name: 'Yönetim', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yönetim ve geçmiş' })).toBeVisible();
  await expect(page.getByText('Bağış kaydedildi', { exact: true })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON arşivini indir' }).click()]);
  expect(download.suggestedFilename()).toMatch(/calcomatesides-yesil-iz-.*\.json/);
});

test('yenileme hatasında son başarılı yayın zamanıyla etiketlenir ve yeniden denenebilir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Birlikte daha yeşil bir gelecek.' })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key.startsWith('calcomatesides:demo:')) throw new Error('test storage outage');
      return original.call(this, key);
    };
    Object.defineProperty(window, 'restoreDemoStorage', { value: () => { Storage.prototype.getItem = original; } });
  });
  await page.getByRole('button', { name: 'Yenile' }).click();
  await expect(page.getByRole('alert')).toContainText('Son başarılı veri gösteriliyor. Son kontrol');
  await expect(page.getByRole('heading', { name: 'Birlikte daha yeşil bir gelecek.' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreDemoStorage: () => void }).restoreDemoStorage());
  await page.getByRole('button', { name: 'Yeniden dene' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Yenile' })).toBeEnabled();
});
