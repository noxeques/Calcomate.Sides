# Doğrulama durumu

11 Kasım 2026. Uzak `main` ve doğrulanan başlangıç commit’i `4e12a3c809bb5109db0d4f2a4ebf23b0dacfcc9d`. GitHub ağ erişimi terminalde çalışmadığı için kaynak GitHub API üzerinden alındı ve yerel Git ağacı ile commit özeti doğrulandı.

## Önceki pilot raporunda bildirilenler

Önceki turda tür kontrolü, 19 yerel test ve üretim derlemesi geçti. Google pilotunda taslak, yayın, arşiv, örnek bağış, tekrar istekleri ve kontrollü yazma hatası sonrası yeniden deneme doğrulandı. Liste dışı hesap panelden reddedildi. Son anonim HTTP kontrolünde 302 → 200, yayın sürümü 5 ve 0 öğe bildirildi.

## Bu turda yapılan kontroller

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

Yayın öncesinde kilitli bağımlılıklarla proje komutlarını ve anonim HTTP kontrolünü tamamlayın. Sahip oturumunda gerçek Sites sayfasının Google JSON yanıtını okuyabildiğini doğrulayın. Liste dışı Google oturumunda yönetim RPC reddini ayrı bir canlı kontrol olarak kaydedin.
