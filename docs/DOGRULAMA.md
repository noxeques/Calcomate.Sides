# Doğrulama durumu

11 Kasım 2026. CalcomateSides pilotu.

- Tür kontrolü, 19 yerel test ve üretim derlemesi geçti.
- Önceki geliştirme turunda gerçek Google verisiyle taslak, yayın, arşiv ve bağış tekrar kontrolleri geçti.
- Bağımsız Google yönetici oturumunda örnek bağış okuması ve ayrı test kaynaklarında yazma hatası/yeniden deneme doğrulandı.
- Liste dışı hesabın panel erişimi reddedildi. Doğrudan canlı yönetim RPC çağrısı yapılmadı; yerel okuma/yazma yetki testleri geçti.
- Yayın hazırlığında çerezsiz anonim HTTP kontrolü yeniden geçti: 302 → 200, yayın sürümü 5.
- Gerçek Sites kökenindeki tarayıcı CORS testi yayın aşamasında yapılacak.

Hesap e-postaları, özel Google dosyalarının bağlantıları ve gerçek kayıtlar bu herkese açık depoda tutulmaz. Yerel servis testleri canlı Google testlerinin yerine geçmez.
