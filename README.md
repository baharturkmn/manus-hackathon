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

Canlı şehir verisi sunucu tarafında toplanır: `.github/workflows/update-live-data.yml` saatte bir `scripts/update-live-data.mjs` betiğini çalıştırır. Betik baraj doluluğunu İBB Açık Veri Portalı'ndaki İSKİ kayıtlarından (`data.ibb.gov.tr`), yağış tahminini MGM'nin günlük tahmin servisinden (`servis.mgm.gov.tr`) alır ve değer değiştiyse `public/data/live.json` dosyasını güncelleyip commit'ler. Sayfa yalnızca bu dosyayı okur; kaynaklara tarayıcıdan istek atılmaz. İSKİ günde bir kez yayımladığı için gösterilen değer en son yayımlanan ölçümdür; ölçüm tarihi ve verinin alındığı saat ekranda yazar. Bir kaynak o saat yanıt vermezse önceki iyi değer korunur; 36 saatten eski yağış tahmini kritik mod kararında kullanılmaz. Dosya yoksa veya okunamazsa değer uydurulmaz; sayfa 12 Ekim 2026 tarihli doğrulanmış kayda döner ve bunu açıkça belirtir.

Bir kaynak GitHub sunucusundan gelen isteği reddederse betik aynı isteği Apify Proxy üzerinden tekrarlar: önce Türkiye çıkışlı residential, plan buna izin vermezse datacenter (`auto`). Bunun için depo ayarlarında `APIFY_PROXY_PASSWORD` gizli anahtarı tanımlanmalıdır; proxy grubu/ülkesi isteğe bağlı `APIFY_PROXY_USERNAME` değişkeniyle değiştirilebilir. `live.json` içindeki `via` alanı verinin doğrudan mı Apify üzerinden mi alındığını kaydeder.

### İSKİ verisi için Türkiye'deki runner

İSKİ ve İBB sunucuları yalnızca Türkiye IP'lerinden gelen bağlantıları kabul ediyor (GitHub, Apify datacenter ve yurt dışı sunucular zaman aşımına düşüyor). Bu yüzden iş akışı iki işe ayrılır: `forecast` (MGM) GitHub'ın sunucusunda, `reservoir` (İSKİ/İBB) ise Türkiye'deki bir makinede kurulu, `turkiye` etiketli self-hosted runner üzerinde çalışır. Makine kapalıyken baraj işi kuyrukta bekler; sayfa son ölçümü tarihiyle göstermeye devam eder. İki iş aynı `live.json` dosyasını güncellediği için `scripts/commit-live-data.sh` gönderim çakışmasında en güncel sürümü alıp yalnızca kendi kısmını yeniden yazar.

Kurulum: depo **Settings → Actions → Runners → New self-hosted runner**, işletim sistemini seç, gösterilen komutları çalıştır; `config.sh` etiket sorduğunda `turkiye` yaz. Makine açıldığında kendiliğinden başlaması için runner klasöründe `./svc.sh install` ve `./svc.sh start`. Depo herkese açık olduğundan iş akışı yalnızca zamanlama ve elle başlatma ile tetiklenir; dış katkıcıların PR iş akışları için **Settings → Actions → General → Require approval for all outside collaborators** seçili olmalıdır.

Elle güncelleme: Türkiye'deki bir makinede `npm run update-data` veriyi çeker ve `public/data/live.json` dosyasını yazar.

İş akışı GitHub'ın zamanlanmış çalıştırma kuralı gereği yalnızca varsayılan dalda (main) çalışır; Actions sekmesinden "Run workflow" ile elle de tetiklenebilir. Güncellenen dosyanın yayına çıkması için sitenin depodaki her commit'te yeniden yayımlanması gerekir. Apify MGM doğrulama kaydı `public/data/apify-mgm-verification.json` dosyasındadır. Yedi günlük kritik mod kuralı eksik tahmin günleri için varsayım yapmaz.

Fatura geçmişi, görevler ve profil yalnızca tarayıcı localStorage hafızasında tutulur; gerçek kullanıcı doğrulaması veya sunucu veritabanı yoktur. OCR tarayıcıda Tesseract.js ile yapılır ve sonuçlar düzenlenebilir. Fatura karşılaştırması toplam tüketim değişimini gösterir; alışkanlık kategorisi kullanıcı bildirimine dayanır, cihaz bazlı ölçüm değildir.

Kuponlar kurgusal demo teklifleridir; gerçek kampanya, ödeme veya ticari marka ortaklığı yoktur. Beş görev kuponu katılım ödülüdür ve fatura şartı yoktur; fatura ödülleri ise en az %5 normalize edilmiş tüketim düşüşü gerektirir. Topluluk litre sayacı semboliktir.

Örnek faturadaki sayaç ve okuyucu tanımlayıcıları bu herkese açık kopyada maskelenmiştir. API anahtarları ve kullanıcıların tarayıcı verileri depoya dahil değildir.

## Kaynak sürüm

Bu depo Manus projesinin bağımsız kopyasıdır; sitenin ana deposu veya yayını bu depoya taşınmamıştır. Kaynak sürüm: `fac6a7f3f6648f29106c8eef2edccff22638e8ef`.
