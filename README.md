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

Canlı şehir verisi sunucu tarafında toplanır: `.github/workflows/update-live-data.yml` saatte bir `scripts/update-live-data.mjs` betiğini çalıştırır (elle: `npm run update-data`). Değer değiştiyse `public/data/live.json` güncellenip commit'lenir; sayfa yalnızca bu dosyayı okur.

- **Baraj doluluğu:** İSKİ'nin günlük ölçümleri [dolulukorani.com/il/istanbul](https://www.dolulukorani.com/il/istanbul) sayfasından okunur (genel doluluk, son günlerin serisi ve "ölçülen barajlar" içindeki en düşük baraj). İSKİ ve İBB Açık Veri sunucuları yalnızca Türkiye IP'lerine cevap verdiği için GitHub'dan doğrudan erişilemiyor; bu site aynı İSKİ verisini yeniden yayımlıyor. Resmî bir API değildir; sayfa yapısı değişirse ayrıştırıcı (`parseDolulukPage`) değer uydurmaz, `null` döner ve önceki değer korunur.
- **Yağış tahmini:** MGM'nin günlük tahmin servisi (`servis.mgm.gov.tr`).

İSKİ günde bir kez yayımladığı için gösterilen değer en son yayımlanan ölçümdür; ölçüm tarihi, kaynak ve verinin alındığı saat ekranda yazar. Bir kaynak o saat yanıt vermezse önceki iyi değer korunur; 36 saatten eski yağış tahmini kritik mod kararında kullanılmaz. Dosya yoksa sayfa 12 Ekim 2026 tarihli doğrulanmış kayda döner ve bunu açıkça belirtir.

İş akışı GitHub'ın zamanlanmış çalıştırma kuralı gereği yalnızca varsayılan dalda (main) çalışır; Actions sekmesinden "Run workflow" ile elle de tetiklenebilir. Güncellenen dosyanın yayına çıkması için sitenin depodaki her commit'te yeniden yayımlanması gerekir.

## Kaynak sürüm

Bu depo Manus projesinin bağımsız kopyasıdır; sitenin ana deposu veya yayını bu depoya taşınmamıştır. Kaynak sürüm: `fac6a7f3f6648f29106c8eef2edccff22638e8ef`.
