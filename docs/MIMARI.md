# Mimari ve veri sözleşmesi

## Kuruluş sınırı

Her kurulumda bir kuruluş anahtarı, bir statik ziyaretçi sitesi, iki bağımsız Apps Script projesi ve üç ayrı Sheets dosyası vardır. Anahtar, kuruluşun yapılandırmasını ve veri dosyası işaretlerini eşleştirir. İstemcide üretim için kuruluş seçme işlevi yoktur.

| Katman | Kaynak | Bağlantı |
| --- | --- | --- |
| Ziyaretçi | `apps/visitor` | Tek sabit Apps Script adresinden anonim JSON. |
| Yönetim arayüzü | `apps/admin` | HTML Service içinde `google.script.run` ile yönetim RPC. |
| Yönetim Apps Script | `gas/admin` | Google kimliği, izin listesi, sürüm ve yazma kilidi. Üç dosya. |
| Kamuya açık Apps Script | `gas/public` | Yalnızca yapılandırılan yayın dosyası, yalnızca `doGet`. |
| Veri modeli | `shared` | Tipler, doğrulama, yayın projeksiyonu, CSV ve raporlama. |
| Yerel Demo | `apps/common/demo.ts` | Aynı kurallar, Web Locks ve tarayıcı depolaması. |

Yönetim `USER_ACCESSING` kimliğinde çalışır. Her giriş ve RPC, Google'ın etkin ve yürütücü e-postalarının eşleşmesini ve sunucu listesindeki izni gerektirir. Google dosya erişimi ayrıca uygulanır. Salt okuma projesi `USER_DEPLOYING` ve `spreadsheets.readonly` kullanır. Ayrı ve sadece yayın dosyasına erişebilen bir dağıtıcı hesap, iki projenin dosya izinlerini de ayırır. [Web uygulaması kimlikleri](https://developers.google.com/apps-script/manifest/web-app-api-executable), [Session](https://developers.google.com/apps-script/reference/base/session), [Sheets OAuth kapsamları](https://developers.google.com/workspace/sheets/api/scopes).

## Kayıtlar

| Kayıt | Başlıca alanlar |
| --- | --- |
| İçerik | `id`, `version`, `createdAt`, `updatedAt`, `status`, `kind`, `title`, `summary`, `body`, `image`, `eventDate`, `location`, onaylı kopya `published`. |
| Bağış | Aynı üstveri, `date`, `amountMinor`, `currency`, `method`, `campaign`, `donor`, `reference`, `note`. |
| Tema | Sabit `settings-main`, üstveri, kuruluş profili, iki tema, iki renk, logo, sıralı menü, iletişim, sosyal ve yasal bağlantılar ile metinler. |
| Günlük | `requestId`, `action`, `actor`, `at`, `digest`, `count`, `ids`, yeni kayıt sürümleri ve varsa `publicVersion`. |

Durumlar içerikte `draft/published/archived`, bağışta `active/cancelled`, ayarlarda `active` değerleridir. Yayımlanmış içerik düzenlenirse çalışma metni ile önceki onaylı metin ayrı kalır. Yeniden yayımlama onaylı metni değiştirir. Arşivleme onu ziyaretçi kopyasından çıkarır. Bağış iptali kaydı saklar ve toplamdan çıkarır. Günlük zamanları UTC ISO, tarih alanları `YYYY-MM-DD`, arayüz gösterimi `tr-TR` ve `Europe/Istanbul` biçimindedir.

`amountMinor` tam sayıdır. TRY, USD, EUR, GBP ve CHF iki basamak, JPY sıfır basamak, KWD üç basamak kullanır. Tutar pozitif, tek kayıt için üst sınır 100.000.000.000 alt birimdir. Dönem sınırları dahildir. Kampanya ve para birimi bazında ayrı toplam hesaplanır. Kampanya boşsa raporda **Kampanyasız** görünür.

## Yazma, tekrar ve yayın

- Yönetim projesinin Script Lock kilidi, sürüm kontrolünü, özel kayıt yazımını ve gerekiyorsa yayın güncellemesini aynı kritik bölümde çalıştırır. Tek bir yönetim projesi veri dosyalarının uygulama yazıcısıdır. Dosyaların doğrudan düzenlenmesi veya aynı dosyalara ikinci bir yönetim projesi bağlanması bu kilidin dışında kalır.
- İstemci her yazmaya istek kimliği verir. Sunucu kimlik, istek içeriğinin SHA-256 özeti ve işlem sahibini karşılaştırır. Bir yanıt belirsizse panel aynı istek gövdesiyle yeniden denerken kimliği oturum içinde korur. Ayrı istekler aynı tarih ve tutara sahip bağışları ayrı kaydeder.
- Her özel yazma veya CSV grubu bir günlük satırıdır. Grup önce tamamen doğrulanır. Sheets’e tek `batchUpdate` gönderilir ve tüm hücreler açık `stringValue` olarak yazılır. Düz metin doğrulaması, güvenli HTTPS adresleri, React metin kaçışları ve CSV dışa aktarımında formül koruması farklı katmanlarda uygulanır. [Sheets toplu işlemleri](https://developers.google.com/workspace/sheets/api/guides/batch), [Hücre yazma istekleri](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request).
- Özel günlükler dosya başına atomiktir. İçerik günlüğü ve yayın dosyası arasındaki iki yazma ayrı işlemlerdir. Özel kayıt yazılmış fakat yayın doğrulanamamışsa `PUBLIC_PENDING` döner. **Yönetim → Yayını yeniden eşitle** en son özel sürümü tekrar üretir. Eski bir isteğin tekrarı güncel sürümü geriye almaz. Ziyaretçi son doğrulanmış kopyayı ve sürüm/zamanını gösterir.
- Yayın dosyası bir güncel snapshot tutar. Kamuya açık proje kendi okumasını yapar ve yönetimin kilidine veya belleğine dayanmaz. İstemci sayfa açılışında ve yenilemede yeni istek gönderir. Başarısız yenilemede açık oturumdaki önceki veri zamanıyla işaretlenir.
- Yönetim listeleri 12’li, ziyaretçi listeleri 9’lu gösterilir. İlk sürümde özel günlükler toplu okunup bellek içinde listelenir. Bu tasarım küçük kuruluşlar içindir. Kullanıma almadan önce beklenen gerçek kayıt hacmini ve Google kotalarını ölçün. [Sheets API kullanım sınırları](https://developers.google.com/workspace/sheets/api/limits).

## Dosya ve ağ biçimi

Her dosyada ilk hücrede bir kuruluş işareti bulunur. `ContentLog` ve `DonationLog` ikinci satırdan itibaren eklemeli günlüklerdir. `Publication` sekmesinde yalnızca ikinci satır güncel yayın kopyasıdır. Satırlar JSON olarak bölünür, A:BL aralığında saklanır. Bir parça en fazla 20.000 UTF-16 birimidir. Günlük ve yayın satırlarını uygulama üretir.

Kamuya açık yanıt `{ ok: true, data: { schema: 1, organizationId, version, publishedAt, settings, items } }` biçimindedir. `items` yalnızca kimlik, yayın zamanı ve onaylı içerik alanları taşır. `settings` kuruluşun herkese açık ayar alanlarıdır. Hatalar `{ ok: false, code, message }` biçimindedir. Kamu uç noktası istek parametrelerinden dosya kimliği, kuruluş veya geri çağırma kodu almaz. Arayüz en fazla 100 eşzamanlı yayımlanmış içerik ve en fazla 100 satırlık CSV grubu destekler.

## CSV

UTF-8 başlık satırı gerekir. Sütun ayırıcı noktalı virgül, virgül veya sekme olarak açıkça seçilir. Ondalık ayırıcı ayrıca seçilir. Binlik ayırıcı kabul edilmez. Tarih, tutar ve ödeme yöntemi eşleştirilir. Para birimi alanı boşsa seçilen varsayılan kullanılır.

```csv
Tarih;Tutar;Para birimi;Ödeme yöntemi;Kampanya;Bağışçı;Referans;Not
2026-11-10;1250,50;TRY;Banka havalesi;Örnek kampanya;;ORNEK-001;Örnek kayıt
```

CSV dışa aktarımı seçili filtreyi ve iptal durumlarını kapsar. Çıktıda riskli hücre başına apostrof eklenir. CSV içe aktarımı her satırı yeni ve etkin bağış olarak ele aldığından CSV dosyası bir geri yükleme biçimi değildir. Tam kayıt ve sürüm geçmişi için özel JSON arşivi ve Sheets yedeğini kullanın.
