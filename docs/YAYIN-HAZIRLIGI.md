# GitHub ve Sites yayın hazırlığı

## Üç ayrı dağıtım hedefi

| Hedef | Gönderilecek çıktı | Erişim |
| --- | --- | --- |
| Sites | `dist/` | Kuruluşun ziyaretçi sitesine uygun kitle. |
| Apps Script yönetim | `build/apps-script/admin/` | Google oturumu ve sunucu izin listesi. |
| Apps Script yayın verisi | `build/apps-script/public/` | Anonim JSON, sabit yayın dosyası. |

Sites yalnızca ziyaretçi arayüzünü barındırır. Yönetim panelinin `google.script.run` bağlantısı Apps Script HTML Service içindedir. Hash tabanlı ziyaretçi bağlantıları, statik barındırmada sunucu yönlendirme kuralı gerektirmez.

## GitHub hazırlığı

- Proje kaynağını, belgeleri, `package-lock.json` dosyasını ve Sites statik çıktı ayarını gözden geçirin. GitHub deposu oluşturulunca bu kaynakları takip edin.
- `.gitignore` yerel ortam değerlerini, clasp yapılandırmasını, üretilen klasörleri ve test çıktılarını dışlar. Üç özel veri dosyası, yedekler, bağış CSV’leri ve JSON arşivleri kaynak depoya girmez.
- Temiz bir kopyada `npm ci`, `npm run typecheck`, `npm test` ve `npm run build` çalıştırın. [README’deki](../README.md) yapılandırmasız paketle tarayıcı testini tamamladıktan sonra kuruluş değerleriyle tekrar derleyin.
- Google projelerini doğrudan Apps Script editöründen güncelleyebilir veya ileride iki ayrı clasp proje eşlemesiyle yönetebilirsiniz. Mevcut `/exec` adresini korumak için var olan web dağıtımını yeni sürüme yönlendirin. [Google clasp rehberi](https://developers.google.com/apps-script/guides/clasp), [Web uygulamaları](https://developers.google.com/apps-script/guides/web).

## Sites hazırlığı

1. [Google kurulumunu](GOOGLE-KURULUM.md) tamamlayın. Kamu projesinin çalışan anonim `/exec` adresini ve kuruluş anahtarını kaydedin.
2. `.env.example` üzerinden `.env.local` oluşturun. `VITE_ORGANIZATION_ID` ile `VITE_PUBLIC_APPS_SCRIPT_URL` değerlerini girip `npm run build` çalıştırın. Bunlar kamuya açık derleme ayarlarıdır.
3. Kuruluş için ayrı Sites projesi açılınca aracın döndürdüğü gerçek `project_id` değerini `.openai/hosting.json` dosyasına işleyin. Hazır statik klasör `dist` olarak tanımlıdır. Yerel kaynak kimliksizdir ve kimlik kaydı sonraki yayın aşamasının parçasıdır.
4. Sites iş akışıyla kaynak sürümünü ve statik ziyaretçi paketini hazırlayın. Hedef kitleyi doğrulayın. Canlı yayından önce önizleme kökeninde aşağıdaki testleri yapın.

## Yönlendirme ve CORS

Apps Script Content Service yanıtı `script.googleusercontent.com` adresine yönlendirir. İlk ve son yanıtı görebilmek için kendi anonim yayın adresinizi kullanarak aşağıdaki tanı komutunu çalıştırın. `curl` testi HTTP akışını gösterir. CORS’u gerçek Sites kökenindeki bir tarayıcı doğrular. [Content Service yönlendirme davranışı](https://developers.google.com/apps-script/guides/content#redirects).

```sh
curl -sS -L -D - "$CALCOMATESIDES_PUBLIC_EXEC_URL"
```

- Anonim oturumdan Sites önizlemesini ve sonra gerçek Sites kökenini açın. Ağ panelinde `/exec` isteğini, son adresi, tarayıcı CORS sonucunu ve JSON gövdesini kontrol edin. Google giriş sayfasına yönlendirme, okunamayan yanıt veya alan adı uyuşmazlığı kurulumun geçmediği anlamına gelir.
- Zararsız bir test etkinliği yayımlayın. Sites sayfasını yenileyin ve yeni sürümü görün. Etkinliği arşivleyip tekrar yenileyin. Gizli taslak ve bağış alanlarının ağ yanıtında bulunmadığını kontrol edin.
- Doğrudan bağlantı CORS nedeniyle kullanılamıyorsa ayrıca onaylanacak seçenek, sabit Apps Script adresine giden salt okuma bir edge proxy’sidir. Proxy yalnızca GET kabul eder, sunucuda Google yönlendirmesini takip eder, çıktı şemasını ve kuruluşu doğrular ve izinli Sites kökenine CORS başlığı döner. Kullanıcı girdisinden hedef URL almaz. Bu seçenekte istemcinin sabit adres doğrulaması kontrollü biçimde güncellenir. Proxy ayrı dağıtım ve bakım yükü getirir. Barındırma, istek sayısı, veri transferi ve kota aşımı maliyeti sağlayıcıya ve trafiğe bağlıdır. Bir fiyat veya ücretsiz kullanım varsayımı yapılmamıştır.
