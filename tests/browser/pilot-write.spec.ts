import { expect, test } from '@playwright/test';
import { EMPTY_SETTINGS } from '../../shared/model';
import type { Donation, Mutation } from '../../shared/model';

test('yazma hatası başarı göstermez ve aynı kayıt isteğiyle yeniden denenir', async ({ page }) => {
  await page.addInitScript((settings) => {
    const state = window as Window & { pilotWriteRequests?: string[] };
    const requests: string[] = [];
    const donations: Donation[] = [];
    state.pilotWriteRequests = requests;
    Object.defineProperty(window, 'google', { value: { script: { run: {
      withSuccessHandler(success: (envelope: unknown) => void) {
        return { withFailureHandler() {
          return {
            adminQuery(name: string) {
              const data = name === 'theme'
                ? { ...settings, organizationName: 'ÖRNEK — Ayrı yazma testi' }
                : name === 'donations'
                  ? { items: donations.slice(), page: 1, pages: 1, total: donations.length }
                  : { campaignOptions: [], totals: [], campaigns: [] };
              success({ ok: true, data });
            },
            adminMutate(input: Mutation) {
              if (input.action !== 'donation.save') throw new Error('Beklenmeyen işlem.');
              requests.push(input.requestId);
              if (requests.length === 1) {
                success({ ok: false, code: 'WRITE_UNKNOWN', message: 'Sheets yazımı doğrulanamadı. Aynı işlemi yeniden deneyin.' });
                return;
              }
              const id = 'r-' + input.requestId;
              const now = new Date().toISOString();
              donations.push({ ...input.fields, id, version: 1, status: 'active', createdAt: now, updatedAt: now });
              success({ ok: true, data: { requestId: input.requestId, ids: [id], count: 1, repeated: false, publicVersion: 0 } });
            },
          };
        } };
      },
    } } } });
  }, EMPTY_SETTINGS);

  await page.goto('http://127.0.0.1:48731/admin.html#bagislar');
  await page.getByRole('button', { name: 'Yeni bağış' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni bağış' });
  await dialog.getByRole('textbox', { name: /Tutar/ }).fill('25,00');
  await dialog.getByRole('textbox', { name: 'Referans' }).fill('ORNEK-YAZMA-TESTI');
  const save = dialog.getByRole('button', { name: 'Bağışı kaydet' });
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Sheets yazımı doğrulanamadı');
  await expect(page.getByText('Bağış kaydedildi.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /ORNEK-YAZMA-TESTI/ })).toHaveCount(0);

  await save.click();
  await expect(page.getByText('Bağış kaydedildi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /ORNEK-YAZMA-TESTI/ })).toHaveCount(1);
  const requests = await page.evaluate(() => (window as Window & { pilotWriteRequests?: string[] }).pilotWriteRequests);
  expect(requests).toHaveLength(2);
  expect(requests?.[0]).toBe(requests?.[1]);
});
