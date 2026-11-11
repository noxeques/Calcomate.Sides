# Doğrulama durumu

11 Kasım 2026. CalcomateSides pilotu. Uzak `main` dalı inceleme başında `4e12a3c809bb5109db0d4f2a4ebf23b0dacfcc9d` commit’indeydi.

## Bu turda doğrulananlar

| Kontrol | Durum | Sonuç |
| --- | --- | --- |
| Temel kontroller | Geçti | Başlangıçta `npm run typecheck`, `npm test` (19 test) ve `npm run build` geçti. |
| Yönetim sunucusu | Geçti (kaynak incelemesi ve yerel test) | Derlenmiş yönetim paketinde `doGet`, `adminQuery` ve `adminMutate` dışarıya açılıyor. Panel, sorgular ve değişiklikler Google’ın etkin ve yürütücü kimliklerinin eşleşmesini ve sunucu izin listesini gerektiriyor. Okuma, dışa aktarma, yazma, CSV, tema ve yayın işlemleri Sheets bağlamı kurulmadan ve işlem kilidi alınmadan önce aynı denetimden geçiyor. Yerel testte boş ve liste dışı kimliklerin istemciden gönderdiği yönetici alanları yetki vermedi. Sunucu `AUTH` döndürdü ve Sheets çağrısı yapmadı. Yönetim kodunda düzeltme gerekmedi. |
| Son kaynak kontrolleri | Geçti | Tür kontrolü, 20 birim testi ve üretim derlemesi geçti. Eklenen test boş yayın, servis hatası ve geçersiz yanıtı ayırıyor. |
| Mevcut tarayıcı testleri | Geçti | Yapılandırmasız üretim paketi ve Demo ile 7 Playwright testi Chrome’da geçti. |
| Anonim Google HTTP kontrolü | Geçti | `npm run pilot:public` çerezsiz istekte 302 → 200, doğru kuruluş, sürüm 5 ve 0 içerik gördü. Ham yayın alanları ve örnek özel işaretler denetimden geçti. |
| Yerel Chrome’dan gerçek Google yayını | Geçti | Üretim paketi yerel kökende ilk açılışta, Yenile düğmesiyle ve tarayıcı yenilemesinde yeni çerezsiz istek gönderdi. Chrome 302 → 200 yönlendirmesinden sonraki JSON’u okudu. Etkinlikler sayfası boş listeyi ve sürüm 5’i gösterdi. |
| Ziyaretçi hata ve tekrar davranışı | Geçti (yerel Chrome, kontrollü yanıtlar) | Boş hata metni, HTML ve bozuk JSON görünür uyarı ve yeniden deneme düğmesi üretti. İlk yayın kopyası henüz yoksa durum mesajı gösterildi. Başarısız yenilemede önceki başarılı sürüm uyarıyla birlikte göründü. Başarılı tekrar yeni sürümü getirdi. |
| Liste dışı hesapla doğrudan canlı yönetim çağrısı | Yapılmadı | Bu kimliğe ait kullanılabilir oturum yoktu. Yerel çağrı testi yukarıda kayıtlıdır. |
| Gerçek Sites kökeninden JSON ve CORS | Yapılmadı | Oturumsuz Sites isteği HTTP 401 döndürdü. Kullanıcının istediği üzere giriş adımı atlandı. |

Ziyaretçi, JSON olmayan yanıtı ve geçersiz JSON ya da yayın biçimini açıklayan bir uyarı gösterir. Yeniden denemeler `cache: no-store` ve güncel istek parametresiyle çalışır. Son başarılı yayın yalnızca açık sayfanın belleğinde tutulur.

## Önceki pilot raporundan

Önceki turda taslak, yayın, arşiv ve bağış tekrar kontrolleri, ayrı yönetici oturumunda örnek bağış okuma, izole yazma hatası ve yeniden deneme ile liste dışı hesabın panelden reddi raporlanmıştı. Bu Google işlemleri bu turda tekrarlanmadı.

Yayın için kalan kabul kontrolü, erişim yetkisi olan bir oturumda mevcut Sites kökeninden anonim JSON isteğinin Google yönlendirmesini tamamladığını ve tarayıcının yanıtı okuyabildiğini görmektir.
