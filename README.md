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

Sekmeli arayüz; İSKİ baraj doluluk görünümü; MGM yağış sinyali; sekiz günlük alışkanlık; beş görevde özel katılım kuponu; sekiz görevde paylaşım kartı; Türkçe OCR ile tek fatura yükleme ve kayıtlı geçmişle 30 güne normalize edilmiş karşılaştırma; kişisel tasarruf seviyesine ve kurgusal markaya bağlı kopyalanabilir kuponlar; şifresiz demo profil.

## Demo sınırları

Baraj ve tahmin verileri 12 Ekim 2026 tarihli doğrulanmış bir anlık kayıttır; her sayfa açılışında otomatik canlı veri çekilmez. Apify MGM doğrulama kaydı `public/data/apify-mgm-verification.json` dosyasındadır. Yedi günlük kritik mod kuralı eksik tahmin günleri için varsayım yapmaz.

Fatura geçmişi, görevler ve profil yalnızca tarayıcı localStorage hafızasında tutulur; gerçek kullanıcı doğrulaması veya sunucu veritabanı yoktur. OCR tarayıcıda Tesseract.js ile yapılır ve sonuçlar düzenlenebilir. Fatura karşılaştırması toplam tüketim değişimini gösterir; alışkanlık kategorisi kullanıcı bildirimine dayanır, cihaz bazlı ölçüm değildir.

Kuponlar kurgusal demo teklifleridir; gerçek kampanya, ödeme veya ticari marka ortaklığı yoktur. Beş görev kuponu katılım ödülüdür ve fatura şartı yoktur; fatura ödülleri ise en az %5 normalize edilmiş tüketim düşüşü gerektirir. Topluluk litre sayacı semboliktir.

Örnek faturadaki sayaç ve okuyucu tanımlayıcıları bu herkese açık kopyada maskelenmiştir. API anahtarları ve kullanıcıların tarayıcı verileri depoya dahil değildir.

## Kaynak sürüm

Bu depo Manus projesinin bağımsız kopyasıdır; sitenin ana deposu veya yayını bu depoya taşınmamıştır. Kaynak sürüm: `fac6a7f3f6648f29106c8eef2edccff22638e8ef`.
