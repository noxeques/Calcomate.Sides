# Google Sheets ve Apps Script kurulumu

Bu işlemleri her kuruluş için ayrı uygulayın. Bir kuruluş anahtarı seçin. Küçük harfle başlasın, 3–40 karakter olsun ve yalnızca küçük ASCII harf, rakam ve kısa çizgi içersin. Aşağıda `ornek-dernek` örnek anahtardır.

## 1. Üç Sheets dosyası

Her satır için ayrı bir Google Sheets dosyası oluşturun. Varsayılan sekmeyi yeniden adlandırın. Sekmede en az 64 sütun (A–BL) ve 2 satır bırakın. A1 hücresine belirtilen işareti yazın ve diğer hücreleri boş bırakın. Dosyanın saat dilimini İstanbul, yerel ayarını Türkiye yapın. Kimliği Sheets URL’sindeki `/d/` ve `/edit` arasından alın.

| Dosya | Sekme adı | A1 örneği | İzin |
| --- | --- | --- | --- |
| İçerik, taslak, ayarlar | `ContentLog` | `CalcomateSides/1:ornek-dernek:content` | Kısıtlı. Yetkili yöneticiler düzenleyici. |
| Bağış günlüğü | `DonationLog` | `CalcomateSides/1:ornek-dernek:donations` | Kısıtlı. Yetkili yöneticiler düzenleyici. |
| Yayın kopyası | `Publication` | `CalcomateSides/1:ornek-dernek:public` | Kısıtlı. Yetkili yöneticiler düzenleyici, ayrı kamu dağıtıcı hesabı görüntüleyici. |

Kamu projesinin dağıtıcı hesabına özel dosyaları veya onları içeren Drive klasörünü paylaşmayın. Üç dosya da Drive’da kısıtlı kalır. Dış erişimi kamu projesinin JSON yanıtı sağlar. Yönetim projesini güvenilir bir Google hesabı oluştursun. Apps Script düzenleyici yetkisini yapılandırmayı yönetmekle görevli kişilerle sınırlayın. Yönetici olarak eklenen hesaplar model gereği Sheets dosyalarını doğrudan düzenleyebilir. Günlük hücrelerinin uygulama dışından değiştirilmesi sürüm denetimini atlar.

## 2. Yönetim projesi

1. `npm ci` ve `npm run build` çalıştırın.
2. Google Apps Script düzenleyicisinde bağımsız bir proje oluşturun. Proje ayarlarından `appsscript.json` görünürlüğünü açın.
3. `build/apps-script/admin/` içindeki `Code.gs` içeriğini `Code.gs` dosyasına, `Index.html` içeriğini **Index** adlı HTML dosyasına ve manifesti `appsscript.json` dosyasına aktarın.
4. Hizmetler bölümünde Google Sheets API v4 hizmetinin `Sheets` adıyla bulunduğunu doğrulayın. Standart bir Google Cloud projesi bağlandıysa Google Sheets API’yi o Cloud projesinde de etkinleştirin. [Gelişmiş Google hizmetleri](https://developers.google.com/apps-script/guides/services/advanced).
5. Proje ayarlarından aşağıdaki **Komut dosyası özelliklerini** oluşturun.

| Özellik | Değer |
| --- | --- |
| `ORGANIZATION_ID` | A1 işaretlerindeki kuruluş anahtarı. |
| `CONTENT_SHEET_ID` | İçerik dosyasının kimliği. |
| `DONATIONS_SHEET_ID` | Bağış dosyasının kimliği. |
| `PUBLIC_SHEET_ID` | Yayın kopyasının kimliği. |
| `ADMIN_EMAILS` | İzinli Google e-postaları, virgülle veya yeni satırla ayrılmış. |

Sonraki yayın aşamasında **Deploy → New deployment → Web app** ile erişen kullanıcı olarak çalıştırın (`USER_ACCESSING`). Varsayılan erişim Google hesabıyla oturum açan kullanıcılardır (`ANYONE`). Tüm yöneticiler tek Workspace alanındaysa `DOMAIN` ile daraltabilirsiniz. Yönetim adresini `/exec` üzerinden yetkili bir yönetici hesabıyla açıp Google kapsamlarını onaylayın. Hesap hem izin listesinde olmalı hem üç Sheets dosyasında düzenleyici erişimine sahip olmalıdır. Hesabın e-postası Google tarafından boş döndürülürse istek reddedilir. Workspace politikaları ve OAuth izin ekranı koşullarını kuruluş hesabında doğrulayın. [Web uygulaması dağıtımı](https://developers.google.com/apps-script/guides/web), [Google kimliği ve oturum](https://developers.google.com/apps-script/reference/base/session).

İlk yayın kopyası için **Tema** bölümünde gerçek kuruluş adını, profilini ve onaylı metinleri kaydedin. Taslak olarak hazırladığınız etkinlikleri ayrıca yayımlayın. Yöneticiyi çıkarırken hem izin listesinden hem Sheets dosya erişiminden kaldırın.

## 3. Anonim salt okuma projesi

1. Ayrı dağıtıcı hesabıyla bağımsız ikinci bir Apps Script projesi oluşturun. Hesaba sadece yayın dosyası için görüntüleyici yetkisi verin.
2. `build/apps-script/public/` içindeki `Code.gs` ve `appsscript.json` dosyalarını ikinci projeye aktarın. `Sheets` v4 hizmeti burada da gerekir. Manifest bu projeye salt okuma kapsamı verir. [Sheets kapsamları](https://developers.google.com/workspace/sheets/api/scopes).
3. Komut dosyası özelliklerine yalnızca `ORGANIZATION_ID` ve `PUBLIC_SHEET_ID` ekleyin.
4. Sonraki yayın aşamasında **Web app** türünde, dağıtan hesap olarak (`USER_DEPLOYING`), anonim erişimle (`ANYONE_ANONYMOUS`) dağıtın. Workspace anonim erişimi engelliyorsa kuruluş politikasıyla uyumlu dağıtım kimliği belirleyin. Yönetim uygulamasını anonim yapmayın. [Web uygulaması manifest alanları](https://developers.google.com/apps-script/manifest/web-app-api-executable).
5. Gizli tarayıcı penceresinde kamu `/exec` adresini açın. Yayın varsa yalnızca izinli JSON alanları dönmelidir. İlk yayın öncesinde `EMPTY` yanıtı beklenir. Site kökeninden erişim kontrolü için [yayın hazırlığına](YAYIN-HAZIRLIGI.md) geçin.

## 4. Yedekleme ve geri yükleme

1. Tüm yöneticilerle yazma işlemlerine ara verin. **Yönetim → Yayın kopyası** bölümünde hedef ve kopya sürümlerini karşılaştırın. Sürümler ayrışmışsa yeniden eşitleyin ve sonucu doğrulayın.
2. Üç dosyanın aynı yedek grubuna ait özel Drive kopyalarını alın. Yedek tarihini, kuruluş anahtarını, yayın sürümünü ve kaynak uygulama sürümünü birlikte saklayın. İsteğe bağlı JSON arşivini yetkili erişimle saklayın.
3. Geri dönüşte üç yedeğin yeni kopyalarını oluşturun. Her kopyada A1 işaretini, sekme adını, genişliği ve izinleri doğrulayın. Önce geri yüklenen üç dosyayı ayrı bir test kurulumunda sınayın.
4. Yazımlar dururken yönetim projesindeki üç dosya kimliğini ve kamu projesindeki yayın dosyası kimliğini birlikte değiştirin. Önceki kimlikleri geri dönüş kaydı olarak saklayın.
5. Yönetimde yayın sürümünü, örnek içerik ve bağışları, işlem geçmişini ve bir test yazımını doğrulayın. Kamu adresini ve siteyi anonim tarayıcıda yenileyin. Test içeriğini arşivleyin ve ardından yazımları açın.

Tam geri yükleme için Sheets kopyaları kullanılır. JSON arşivi inceleme ve kayıt taşıma içindir. Uygulama arayüzünde JSON geri yükleme komutu bulunmaz.
