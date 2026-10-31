# SuNöbeti

İstanbul'un görünmeyen su stresini gündelik alışkanlıklar, fatura karşılaştırması ve kurgusal marka ödülleriyle görünür kılan hackathon prototipi.

## Çalıştırma

Node.js 22 ile:

```bash
npm ci
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır.

```bash
npm test
npm run build
npm run preview
```

## Özellikler

Sekmeli arayüz; İSKİ baraj doluluk görünümü; MGM yağış sinyali; sekiz günlük alışkanlık; beş görevde özel katılım kuponu; sekiz görevde paylaşım kartı; Türkçe OCR ile tek fatura yükleme ve kayıtlı geçmişle 30 güne normalize edilmiş karşılaştırma; kişisel tasarruf seviyesine ve kurgusal markaya bağlı kopyalanabilir kuponlar; kullanıcıya özel hesaplar (e-posta/şifre veya Google).

## Demo sınırları

Canlı şehir verisi sunucu tarafında toplanır: `.github/workflows/update-live-data.yml` saatte bir `scripts/update-live-data.mjs` betiğini çalıştırır (elle: `npm run update-data`). Değer değiştiyse `public/data/live.json` güncellenip commit'lenir; sayfa yalnızca bu dosyayı okur.

- **Baraj doluluğu:** İSKİ'nin günlük ölçümleri [dolulukorani.com/il/istanbul](https://www.dolulukorani.com/il/istanbul) sayfasından okunur (genel doluluk, son günlerin serisi ve "ölçülen barajlar" içindeki en düşük baraj). İSKİ ve İBB Açık Veri sunucuları yalnızca Türkiye IP'lerine cevap verdiği için GitHub'dan doğrudan erişilemiyor; bu site aynı İSKİ verisini yeniden yayımlıyor. Resmî bir API değildir; sayfa yapısı değişirse ayrıştırıcı (`parseDolulukPage`) değer uydurmaz, `null` döner ve önceki değer korunur.
- **Yağış tahmini:** MGM'nin günlük tahmin servisi (`servis.mgm.gov.tr`).

İSKİ günde bir kez yayımladığı için gösterilen değer en son yayımlanan ölçümdür; ölçüm tarihi, kaynak ve verinin alındığı saat ekranda yazar. Bir kaynak o saat yanıt vermezse önceki iyi değer korunur; 36 saatten eski yağış tahmini kritik mod kararında kullanılmaz. Dosya yoksa sayfa 12 Ekim 2026 tarihli doğrulanmış kayda döner ve bunu açıkça belirtir.

İş akışı GitHub'ın zamanlanmış çalıştırma kuralı gereği yalnızca varsayılan dalda (main) çalışır; Actions sekmesinden "Run workflow" ile elle de tetiklenebilir. Güncellenen dosyanın yayına çıkması için sitenin depodaki her commit'te yeniden yayımlanması gerekir.

## Günlük görevler

Görev listesi `task-catalog.mjs`'den gelir ve her kullanıcıya göre değişir:

- **Evini tanıt:** İlk girişte 7 soru (duş, çift tuşlu sifon, bulaşık/çamaşır makinesi, bitki/bahçe, balkon, araba). Yalnızca evde karşılığı olan görevler gösterilir; cevaplar kullanıcı kaydının `household` alanında tutulur.
- **Günlük:** Diş fırçalama, duş, sifon, bulaşık; çamaşır isteğe bağlıdır ve tamamlanma sayısına girmez.
- **Günün görevi:** Basit görevlerden her gün biri, tarihe göre dönüşümlü.
- **Seviyeye özel:** Şehir Dikkat'teyken araba ve balkon görevleri, Kritik'teyken bunlara ek olarak sabunlanırken suyu kapatma, biriktirilmiş suyla sulama ve su bidonu hazırlama eklenir.
- **Mevsimlik:** Bitki sulama saati, Mayıs–Eylül.
- **Evini bir kere hazırla:** Sifon kaçak testi, perlatör, duş başlığı, damlayan musluk. Bir kez işaretlenir, tarihiyle saklanır.

`firestore.rules` bu yüzden `household` alanına izin verir; kural değişikliği Firebase'e yüklenmeden hesaplı kullanıcıların kayıtları reddedilir.

## Kritik mod

Seviye (Normal, Dikkat, Kritik, Acil) her saatlik çalıştırmada `critical-mode.mjs` ile `public/data/history.json`'daki günlük doluluk geçmişinden hesaplanır ve `live.json`'daki `criticalMode` bloğuna yazılır; site yalnızca bu bloğu gösterir.

- **Dikkat:** doluluk %40'ın veya mevsim normalinin 20 puan altında.
- **Kritik:** doluluk %25'in altında, ya da son 28 günün hızıyla %20'ye 60 günden az kalmış, ya da doluluk %35'in altında ve mevsim normalinin 20 puan altında.
- Bir koşul art arda 2 gün sağlanınca seviye yükselir; Kritik'ten çıkmak için 7 gün boyunca koşul olmaması ve dolulukun %40'ın (Dikkat için %45'in) üstünde olması gerekir.
- **Acil:** İSKİ resmî kesinti veya kısıtlama duyurduğunda `public/data/official-status.json` içinde `active: true` yapılır.
- Mevsim normali yalnızca önceki yılların aynı günlerinden (±7 gün) hesaplanır. Yağış tahmini seviyeyi belirlemez.

`history.json`, İBB Açık Veri Portalı'ndaki İSKİ günlük doluluk dosyalarından (Ekim 2000 – Şubat 2024) temizlenerek oluşturuldu; saatlik iş her yeni ölçümü ekler. Eşikler bu geçmişte kalibre edildi: doluluğun %25'in altına indiği beş krizin hepsinde Kritik mod 42–302 gün önce açılırdı, en düşük dolulukun %40'ın üstünde kaldığı yıllarda hiç açılmazdı (`tests/critical-mode.test.mjs` bu sonucu kontrol eder). 2024 Şubat – 2026 Ekim arası geçmişte yok; 28 günlük trend koşulu yeterli ölçüm biriktikten sonra devreye girer.

## Fatura okuma

Fatura fotoğrafı yalnızca cihazda okunur (Tesseract.js, Türkçe); sunucuya gönderilmez.

1. **Ön işleme** (`bill-image.mjs`): fotoğraf EXIF yönüne göre çevrilir, küçükse büyütülür, renk kanallarının en koyusu alınır (açık mavi/gri etiketler koyulaşır) ve kontrast gerilir.
2. **İki geçiş**: önce blok düzeninde okunur; tüketim ve gün sayısı kesinleşmezse daha koyu görüntü dağınık metin modunda ikinci kez okunur.
3. **Ayrıştırma** (`bill-parser.mjs`): fatura düzenine bağlı etiket aramak yerine her alan için birbirinden bağımsız ipuçları toplanır ve oylanır:
   - **Tüketim (m³):** endeks farkı (ilk/son okuma satırı, "İlk Endeks / Son Endeks", tablo başlığı + değer satırı, yan yana iki benzer sayı), etiketli değer, "m³" birimli sayı, günlük ortalama × gün.
   - **Gün sayısı:** iki okuma tarihinin farkı (son ödeme ve fatura tarihi ayrılır), etiketli değer, "33 gün" / "GÜN: 30" yazımları.
   - **Dönem:** 202602, 2026/02, 02/2026, "Şubat 2026", "Ekim/2026", son okuma tarihi.
   - **Tutar ve son ödeme tarihi:** bilgi amaçlı.

   İki kaynak aynı değeri verirse alan **yüksek güvenli** (yeşil) olur; tek kaynak ya da çelişki varsa alan sarı işaretlenir ve kullanıcıdan kontrol istenir. Okunamayan ya da tutarsız rakamlar (geçersiz tarih, son endeks < ilk endeks) tahmin edilmez, boş bırakılır.

Testler (`tests/bill-parser.test.mjs`) gerçek OCR çıktılarıyla çalışır: örnek İSKİ fotoğrafı, farklı düzenlerde üretilmiş faturalar ve kurallar yazıldıktan sonra körlemesine denenen iki yeni düzen (`tests/fixtures/bills/`).

## Kullanıcı hesapları

Her kullanıcının görevleri, fatura geçmişi ve tasarruf kayıtları kendi hesabında tutulur (Firebase Authentication + Cloud Firestore, belge: `users/{uid}`). Giriş: e-posta/şifre veya Google; şifre sıfırlama, çıkış ve "hesabımı ve kayıtlarımı sil" desteklenir. Giriş yapmayan ziyaretçi "misafir" olarak kalır ve kayıtları yalnızca o tarayıcıda durur; misafir ilk kez hesap açtığında bu cihazdaki kayıtları hesabına taşınır. Fatura görseli yalnızca cihazda OCR ile okunur, hesaba sadece Toplam m³, gün sayısı ve dönem kaydedilir.

Kod: `user-store.mjs` (misafir/hesap veri katmanı), `account.mjs` (giriş penceresi ve Firebase), `firebase-config.mjs` (proje ayarları), `firestore.rules` (her kullanıcı yalnızca kendi belgesini okuyup yazabilir; başka alan eklenemez).

**Kurulum (bir kerelik):**
1. https://console.firebase.google.com → **Proje ekle**.
2. **Build → Authentication → Get started** → *Sign-in method*: **Email/Password** ve **Google**'ı etkinleştir. *Settings → Authorized domains*: `baharturkmn.github.io` ekle (`localhost` varsayılan olarak vardır).
3. **Build → Firestore Database → Create database** (konum: `europe-west`) → **Rules** sekmesine `firestore.rules` içeriğini yapıştırıp **Publish**.
4. **Project settings → Your apps → Web (</>)** ile bir web uygulaması ekle; çıkan `firebaseConfig` değerlerini `firebase-config.mjs` içindeki tırnakların arasına yaz. Bu değerler gizli değildir; erişimi kurallar korur.

`firebase-config.mjs` boşken site misafir modunda çalışır ve Firebase yüklenmez. Yerel geliştirmede Firebase emülatörü için `VITE_FIREBASE_EMULATOR_HOST=127.0.0.1` kullanılabilir.

## Yayın

Site GitHub Pages'te yayımlanır: https://baharturkmn.github.io/manus-hackathon/ . `.github/workflows/deploy-pages.yml` her `main` push'unda ve saatlik veri işi bittikten sonra testleri çalıştırır, `vite build --base=/manus-hackathon/` ile derler ve yayımlar. Bir kez **Settings → Pages → Source: GitHub Actions** seçilmelidir. Manus'taki ilk yayın bu depodan beslenmez; güncel veri yalnızca bu yayında görünür.

## Kaynak sürüm

Bu depo Manus projesinin bağımsız kopyasıdır; sitenin ana deposu veya yayını bu depoya taşınmamıştır. Kaynak sürüm: `fac6a7f3f6648f29106c8eef2edccff22638e8ef`.
