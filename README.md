# CalcomateSides

CalcomateSides, Calcolit firmasının ürünüdür. Dernek ve kuruluşlar için Türkçe ziyaretçi sitesi ve yönetim paneli sağlar. Kuruluşlar ayrı site, iki ayrı Google Apps Script projesi ve üç ayrı Google Sheets dosyası kullanır.

## Yerelde çalıştırma

Node.js 22.12+ ve npm gerekir. Terminali bu dosyanın bulunduğu proje klasöründe açın.

```sh
npm ci
npm run dev:demo -- --port 5173 --strictPort
```

| Kuruluş | Ziyaretçi sitesi | Yönetim paneli |
| --- | --- | --- |
| Yeşil İz Derneği | [Ana sayfa](http://127.0.0.1:5173/) | [Yönetim](http://127.0.0.1:5173/admin.html) |
| Mavi Köprü Derneği | [Ana sayfa](http://127.0.0.1:5173/?org=mavi-kopru) | [Yönetim](http://127.0.0.1:5173/admin.html?org=mavi-kopru) |

Demo örnek kayıtlarla açılır. Değişiklikler tarayıcıda, kuruluş başına ayrı anahtarla saklanır. Yönetim ve ziyaretçi için aynı tarayıcı profili ve aynı adresi kullanın. Demo verilerini temizlemek için tarayıcının bu kökene ait site verilerini kaldırın. Gerçek bağışçı verisi girmeyin.

Hızlı akış için yönetimde **İçerik → Yeni içerik** ile bir etkinlik oluşturun. Tarih, yer ve açıklama ekleyin, taslağı kaydedin, listedeki **Yayımla** düğmesiyle onaylayın. Ziyaretçi sitesinin **Etkinlikler** sayfasını yenileyin. **Arşivle** ardından sayfayı tekrar yenilediğinizde etkinlik kaldırılır.

## Doğrulama ve derleme

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Yerel Chrome kuruluysa tarayıcı indirmek yerine `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` kullanabilirsiniz. Tarayıcı testleri Demo için 5173, üretim paketi için 48731 portunu kullanır. Üretim kurulum hatasını sınamak için derleme sırasında iki `VITE_` değişkeni boş olmalıdır. Gerçek bağlantı ayarları bulunan bir çalışma kopyasında bu paketi `VITE_ORGANIZATION_ID= VITE_PUBLIC_APPS_SCRIPT_URL= npm run build` komutuyla sınayın, ardından üretim ayarlarıyla tekrar derleyin.

| Çıktı | Kullanım |
| --- | --- |
| `dist/` | Sites için statik ziyaretçi sitesi. |
| `build/apps-script/admin/` | Yönetim projesine aktarılacak `Code.gs`, `Index.html` ve manifest. |
| `build/apps-script/public/` | Anonim salt okuma projesine aktarılacak `Code.gs` ve manifest. |

`npm run dev` Demo modunu açmaz. Yönetim arayüzünün üretim bağlantısı yalnızca Apps Script HTML Service içinden çalışır. Ziyaretçi derlemesi `.env.local` dosyasında `VITE_ORGANIZATION_ID` ile anonim okuma projesinin `VITE_PUBLIC_APPS_SCRIPT_URL` değerini bekler. Örnek yapı için `.env.example` dosyasını kullanın. Dağıtımdan sonra Node.js gerekmez.

## Pilot doğrulama araçları

Google izinleri ve ayrı yayın hesabı hazır olduğunda anonim adresi aşağıdaki komutla sınayın.

```sh
CALCOMATESIDES_PUBLIC_EXEC_URL='GERCEK_ANONIM_EXEC_ADRESI' npm run pilot:public
```

Komut anonim HTTP yönlendirmelerini, kuruluşu, ham yayın alanlarını ve örnek özel kayıt işaretlerinin sızmadığını denetler. Çıktıdaki başarılı HTTP sonucu tarayıcı CORS testi yerine geçmez. Gerçek adres tanımlanana kadar komut açık kurulum hatasıyla çıkar.

`CALCOMATESIDES_EXPECT_EVENT_ID` ile yayında olması gereken, `CALCOMATESIDES_ABSENT_EVENT_ID` ile bulunmaması gereken etkinlik kimliğini belirtebilirsiniz. `CALCOMATESIDES_PRIVATE_SENTINEL` alanına özel taslak başlığını veya başka bir özel test işaretini verebilirsiniz.

`scripts/pilot/ReplayCheck.gs` yalnızca pilot yönetim projesinin editöründe geçici test dosyası olarak çalıştırılır. Ayrı pilot dosyalarının kimliklerini doğruladıktan sonra editörde `PILOT_REPLAY_SHEET_IDS` komut dosyası özelliğine `CONTENT_SHEET_ID`, `DONATIONS_SHEET_ID` ve `PUBLIC_SHEET_ID` anahtarlarıyla bir JSON nesnesi girin. Bu değerler kaynak depoya girmez. `pilotReplayCheck` işlevi bu değerleri etkin yapılandırmayla karşılaştırıp bir örnek bağış ve bir örnek CSV kaydını aynı istek kimlikleriyle iki kez gönderir. Tekrar çalıştırmalar aynı kayıtları doğrular. Test sonunda geçici dosyayı ve özelliği editörden kaldırın. Dosya normal derleme paketine dahil değildir.

## Belgeler

- [Mimari ve veri sözleşmesi](docs/MIMARI.md)
- [Google Sheets ve Apps Script kurulumu](docs/GOOGLE-KURULUM.md)
- [GitHub ve Sites yayın hazırlığı](docs/YAYIN-HAZIRLIGI.md)
- [Test sonuçları ve canlı kontroller](docs/DOGRULAMA.md)

© 2026 Calcolit. CalcomateSides servis yazılımı Calcolit firmasına aittir. Tüm hakları saklıdır.

## Bu pilotun yayın yapılandırması

Bu kaynak sürümünde `.env.production`, yalnızca herkese açık pilot kuruluş anahtarını ve anonim JSON adresini içerir. Üretim derlemesi bu dosyayı kullanır. Başka kuruluş kurarken bu iki değeri değiştirin; dosyaya şifre veya gizli anahtar eklemeyin. `.env.local` yerel geçersiz kılmalar için Git dışında kalır.

GitHub kaynak deposu: https://github.com/noxeques/Calcomate.Sides

Sites yayını ziyaretçi arayüzünü sunar. Yönetim uygulaması ve Google dosyalarının erişimleri ayrıca korunur. Yeni Sites kaydının ilk yayını owner-private erişimle yapılır.
