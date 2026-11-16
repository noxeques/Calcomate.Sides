# Doğrulama durumu

## 16 Kasım 2026

Uzak `main` başlangıcı `cdab3c8fe9784e5fc984aa05633c6ff771cdba8b`. PR #2 bu commit’te birleşmişti. Paylaşılan `4e12a3c809bb5109db0d4f2a4ebf23b0dacfcc9d` başlangıcından sonraki iki commit çalışma dalının tabanında korundu.

### Sunucu yetkilendirmesi

Dağıtım girişleri `doGet`, `adminQuery` ve `adminMutate`. Yönetim manifesti erişen Google kullanıcısı adına çalışır. Üç giriş de boş olmayan Google etkin kullanıcı kimliğini, yürütme kimliğiyle eşleşmesini ve sunucu izin listesini kontrol eder. RPC bağlamı ancak bu kontrolden sonra kuruluşu ve dosya ayarlarını okur, Sheets erişimini ve gerekli kilidi açar. İstemcinin gönderdiği e-posta veya rol yetki kararında kullanılmaz. Yönetim sunucusunda düzeltme gerekmedi.

Apps Script servisleri yerelde taklit edilerek sekiz sorgu ve sekiz değişiklik, dört reddedilen kimlik durumu için çalıştırıldı. Kapsama bağış ve CSV, tema, yayın, arşiv, dışa aktarım ve yeniden eşitleme dahil. 64 RPC çağrısı `AUTH` döndürdü, dört panel girişi reddedildi. Test izin listesi dışında kuruluş ve dosya ayarlarının okunmadığını, kilit veya Sheets çağrısı yapılmadığını doğruladı. Boş izin listesi ayrıca sınandı.

### Ziyaretçi veri okuması

Ziyaretçi `fetch` çağrısının son yanıt adresi artık pilot HTTP kontrolüyle aynı Google adres kuralından geçiyor. İstemci yalnızca izinli Google adreslerinden gelen JSON’u işler. Yayın kopyası yoksa veya kaynak yapılandırması uyuşmuyorsa önceki yayın görünümden kaldırılır. Geçici ağ, servis ve yanıt hatalarında son başarılı verinin saatiyle birlikte hata ve yeniden deneme düğmesi gösterilir. Geçerli ve boş öğe listesi normal boş içerik ekranını açar. Çerez gönderilmez, HTTP önbelleği kullanılmaz ve yenileme yeni bir istek üretir.

### Çalıştırılan kontroller

Windows terminali sandbox yapılandırma hatası verdi. Proje komutları GitHub Actions üzerinde Ubuntu ve Node 24 ile kilitli bağımlılıklar kullanılarak çalıştırıldı. Doğrulama için kullanılan geçici workflow teslim farkından çıkarıldı.

| Kontrol | Başlangıç | Değişiklik sonrası |
| --- | --- | --- |
| `npm ci` ve `npm run typecheck` | Geçti | Geçti |
| `npm test` | 21/21 | 22/22 |
| `npm run build` | Geçti | Geçti |
| `npm run test:browser` | 7/7 | 7/7 |
| `npm run pilot:public` | Google 302 → 200, sürüm 5, 0 öğe | Google 302 → 200, sürüm 5, 0 öğe |
| Kontrollü üretim arayüzü | — | Geçerli boş yayın, farklı kuruluş gelince eski yayının kaldırılması ve yeniden denemeyle toparlanma geçti. |
| Gerçek anonim JSON, yerel Chromium kökeni | — | İlk açılış ve Yenile, farklı `fresh` değerleriyle ayrı ayrı Google 302 → 200 aldı. Uygulama JSON’u okuyup yayını gösterdi. |

[Başlangıç çalışması](https://github.com/noxeques/Calcomate.Sides/actions/runs/43928730915) · [Değişiklikli kaynak çalışması](https://github.com/noxeques/Calcomate.Sides/actions/runs/43929212633)

### Canlı kontroller

- **Gerçek Sites kökeninden CORS yapılmadı.** Sahip oturumu için istendiği gibi giriş adımı atlandı. Sites bilgisi sorgusu bu bağlantıda projeyi bulamadı. Yerel Chromium testi kendi `127.0.0.1` kökeninde çalıştı.
- **Liste dışı hesapla canlı yönetim RPC doğrulanmadı.** Kullanılabilir liste dışı Google oturumu yoktu. Canlı Apps Script dağıtımlarına, izinlere, Sheets kayıtlarına ve Sites yayınına işlem yapılmadı.
- Yayın kararı öncesinde mevcut Sites kökenindeki Google JSON okumasını sahip oturumunda ve doğrudan yönetim RPC reddini liste dışı Google oturumunda doğrulayın. Ardından taslak PR incelenerek mevcut Sites projesinde ziyaretçi paketi güncellenebilir.

## 11 Kasım 2026 kaydı

Uzak `main` ve doğrulanan başlangıç commit’i `4e12a3c809bb5109db0d4f2a4ebf23b0dacfcc9d`. GitHub ağ erişimi terminalde çalışmadığı için kaynak GitHub API üzerinden alındı ve yerel Git ağacı ile commit özeti doğrulandı.

### Önceki pilot raporunda bildirilenler

Önceki turda tür kontrolü, 19 yerel test ve üretim derlemesi geçti. Google pilotunda taslak, yayın, arşiv, örnek bağış, tekrar istekleri ve kontrollü yazma hatası sonrası yeniden deneme doğrulandı. Liste dışı hesap panelden reddedildi. Son anonim HTTP kontrolünde 302 → 200, yayın sürümü 5 ve 0 öğe bildirildi.

### 11 Kasım kontrolleri

| Kontrol | Sonuç |
| --- | --- |
| Yerel Node testleri | Başlangıçta 19/19, çalışma dalında 21/21. Aynı test dosyaları Node 24’ün TypeScript dönüşümü ve uzantısız içe aktarımlar için geçici çözümleyiciyle çalıştırıldı. |
| Tür kontrolü | TypeScript 5.9.3 ile ortak kod, Apps Script, pilot araçları ve Node testleri iki kaynak sürümünde de geçti. Çalışma dalında yeni ziyaretçi veri istemcisi de bu kapsama alındı. |
| Apps Script sunucu paketleri | Yerel esbuild 0.28.2 ile deponun Apps Script paketleme işlevi çalıştırıldı. Yönetim paketi yalnızca `doGet`, `adminQuery` ve `adminMutate`; anonim paket yalnızca `doGet` dışa aktardı. Değişen ziyaretçi TSX dosyasının sözdizimi dönüşümü de geçti. |
| Sunucu yetkilendirmesi | Panel ve RPC girişleri Sheets bağlamı kurulmadan önce ortak kontrolü uyguluyor. Kontrol Google oturumundan gelen boş olmayan, yürütme hesabıyla eşleşen ve listede yer alan kimliği istiyor. Paket üzerinde sekiz sorgu ve sekiz değişiklik, boş ve liste dışı kimlikle 32 kez denendi. İstemci izinli kimliği parametre olarak gönderse bile her çağrı `AUTH` döndürdü. Test ortamı kuruluş ayarlarına, Sheets’e ve kilide erişim sağlamadı. |
| Ziyaretçi veri istemcisi | Yerel testler geçerli boş listeyi, yenilemeyle yeni sürümü, yayın kopyasının yokluğunu, ağ ve HTTP hatasını, geçersiz JSON ve veri biçimini, HTML yanıtını ve kuruluş uyuşmazlığını kapsadı. İstek Google yönlendirmesini takip edecek şekilde, CORS modunda ve çerez ile HTTP önbelleği kullanılmadan hazırlanıyor. Geçici hatada son başarılı veri zamanıyla etiketleniyor. Servis yayın kopyasının olmadığını bildirdiğinde eski içerik kaldırılıyor. |
| Kilitli bağımlılıklarla proje komutları | `npm ci`, npm kayıt sunucusu için `ENOTFOUND` ile durdu. `npm run typecheck`, `npm test`, `npm run build` ve `npm run test:browser` denendi, eksik bağımlılıklar nedeniyle tamamlanamadı. Tam tür kontrolü ve üretim derlemesi bekliyor. |
| Yerel tarayıcı yönlendirme denemesi | Yerel Chrome test sayfası `ERR_NETWORK_ACCESS_DENIED` ile açılmadı. Tarayıcı CORS sonucu alınamadı. |
| Anonim canlı HTTP | `npm run pilot:public` eksik `tsx` nedeniyle başlamadı. Aynı kaynak dosyası doğrudan Node ile çalıştırıldığında Google adresi `ENOTFOUND` verdi. Güncel HTTP durumu, sürüm ve öğe sayısı doğrulanamadı. |
| Gerçek Sites kökeni | **Yapılmadı.** Sahibine özel erişim için geçerli Sites oturumu kullanılmadı. |
| Canlı liste dışı yönetim RPC | **Yapılmadı.** Kullanılabilir liste dışı Google oturumu kurulamadı. Google izinleri ve canlı kayıtlar üzerinde işlem yapılmadı. |

Pilot tekrar aracındaki sabit özel Sheets kimlikleri ve bunların test kopyaları kaynak dosyalarından çıkarıldı. Araç, editördeki ayrı pilot kimlikleri etkin yapılandırmayla eşleşmeden yazma çağrısı yapmıyor. Önceki commit geçmişi bu değişiklikle yeniden yazılmadı.

11 Kasım kaydında kilitli proje komutları, anonim HTTP, gerçek Sites kökeni ve liste dışı Google oturumunda RPC reddi bekliyordu.
