# SuNöbeti implementation outcomes

- [ ] Build a single working, clean, modern, data-forward, mobile-friendly campaign page called SuNöbeti for Istanbul’s water crisis, with blue/water tones and a dry/cracked-earth visual treatment reserved for critical mode.
- [ ] Show a large, readable “Bugünün Durumu” view with the latest verified İSKİ general reservoir occupancy percentage, clearly labeled with source and date, and a short trend line or mini-chart using recent real İSKİ measurements.
- [ ] Implement the conditional “Kritik Tasarruf Modu” rule: activate only when occupancy is below 35% and no significant rain is forecast in the next 7-day window; otherwise show the calmer “Dikkatli Kal” state. Explain the rule briefly on the page and do not fabricate a number if source data is unavailable.
- [ ] Show the current MGM Istanbul forecast signal with real forecast dates and rainfall events, clearly distinguishing the official city-page horizon and the conservative 7-day gate used by the prototype.
- [ ] Provide 3–5 checkable daily water-saving tasks, symbolic points, a progress count, and a completion badge.
- [ ] Provide a “Partner Markalar” section with generic placeholder eco-conscious brand names only, and discount codes tied to the day’s verified 38.11% reservoir value.
- [ ] Include a non-alarmist campaign tagline and 2–3 sentence mission explanation that makes the invisible crisis visible without blaming residents.
- [ ] Include pitch-ready 3–4 sentence campaign copy and one short social-media-style caption for Critical Savings Mode that use the verified current data and do not claim critical mode is active when the rule is false.
- [ ] Add clear source links/notes for İSKİ and MGM, with “last verified” metadata and a data-access fallback state rather than invented values.

## Kayıtlı fatura karşılaştırması düzeltmesi — 12 Ekim 2026

- [x] Tek güncel fatura yükleme alanı korunur. Yeni giriş varsa daha eski kayıtla; giriş boşsa geçmişteki son iki fatura 30 güne normalize edilerek karşılaştırılır. Dönem bilgileri varsa tarih sırası kullanılır; yoksa kayıt sırası esas alınır.
- [x] “Son kayıtla karşılaştır” butonu görünür sonucu veya açıklayıcı bir eksik veri mesajını gösterir ve ilgili alana götürür. Faturayı kaydetmek sonucu gizlemez; sayfa yeniden açılınca kayıtlı iki faturanın sonucu geri gelir.
- [x] Sonuç kartında önceki/güncel m³/30 gün, yüzde değişim, mevcut görevlerden üç öneri ve %5–10 azaltım hedefi gösterilir. %5+ düşüşte kurgusal marka kuponları açılır; artış/aynı tüketim/daha küçük düşüşte destekleyici mesaj ve öneriler gösterilir.
- [x] 15 otomatik test ve canlı buton testi geçti: 12 m³/30 gün → 10 m³/30 gün, farklı dönem uzunlukları, kaydetme sonrası boş alanlarla yeniden karşılaştırma, sayfa yenileme ve ekran görüntüsündeki 202402/202509 tarihli kayıtlar.

## Kupon kopyalama ve marka teklifleri — 12 Ekim 2026

- [x] Ana ödül kartı ve dört kurgusal marka ürün kartında kazanılmış kodun yanında erişilebilir “KOPYALA” butonu bulunur. Yalnızca kod panoya gider; başarıda “KOPYALANDI” ve canlı durum mesajı gösterilir. Pano erişimi yoksa alternatif kopyalama denenir; başarısızlıkta kod elle seçilebilir ve açık hata mesajı gösterilir.
- [x] %5–10 altı doğrulanmış tasarrufta demo oranları BrightSmile %10, PureWave %12, CleanCycle %15, SparkleWash %8; %10+ tasarrufta sırasıyla %20, %18, %25, %15 olur. Bunlar gerçek kampanya değil kurgusal demo teklifleridir. Kodda kullanıcının yuvarlanmış tasarruf yüzdesi yer alır; indirim oranı ayrıca yazılır.
- [x] Uygun karşılaştırma sonrası teklifler hemen gösterilmez; 2, 4, 6 ve 8. saniyelerde sırayla açılır. Aynı sonucu tekrar hesaplamak süreleri sıfırlamaz; yeterli tasarruf kalmazsa bekleyen açılmalar iptal edilir. Açılan kartlar hafif görsel vurguyla belirginleşir ve düşük hareket tercihine saygı gösterilir.
- [x] 25 otomatik test geçti. Canlı sayfada 0→1→2→3→4 teklif dizisi, dört farklı indirim, ana kart ve ürün kartı kopyalama onayı ve şart değişince bekleyen kuponların iptali doğrulandı.

## Kişisel sonuç içinde isteğe bağlı ödül — 12 Ekim 2026

- [x] Ürün konsept kartlarında kupon, indirim oranı, kopyalama butonu veya zamanla otomatik açılan teklif bulunmaz; kartlar yalnızca alışkanlık/ürün fikrini anlatır.
- [x] İndirim markadan bağımsız, iki faturanın 30 günlük normalize edilmiş tüketim düşüşüne bağlıdır. Mevcut demo politikası korunur: %5–10 altı düşüşte %10, %10+ düşüşte %20; %5 altında kupon yoktur. Gerçek kampanya olmadığı açıklanır.
- [x] Kupon kodu ve indirim detayı yalnızca kişisel fatura sonucunda “Ödülümü gör” tıklanınca gösterilir. Marka seçiminde yalnızca kod son eki değişir; tasarruf ve indirim oranı aynı kalır. “Ödülümü gizle” kodu kaldırır. Yeni karşılaştırma paneli yeniden kapalı başlatır. Kopyalama işlevi korunur.
- [x] 27 otomatik test ve canlı görünürlük testi geçti: ürün kartlarında 0 kupon, beklemekle açılmama, %9,1 → %10 indirim, %16,7 → %20 indirim, marka değişiminde oran korunması ve tasarruf yokken kupon oluşmaması.

## Sekmeli, sadeleştirilmiş sayfa — 12 Ekim 2026

- [x] Uzun tek akış yerine beş sekme: Bugünün Durumu, Günlük Görevler, Faturam ve Ödülüm, Ürün Fikirleri, Proje Hakkında. Aynı anda yalnızca seçili panel görünür.
- [x] Üst tanıtım kısaltıldı. Şehir doluluğu, kritik/sakin mod ve sekme çubuğu içerik kaydırılırken üstte kalır; sembolik topluluk sayacı açılışta korunur.
- [x] Yağış/mod ayrıntısı, marka dashboard/modeli ve sunum metinleri ilgili sekme içinde isteğe bağlı açılır alanlara taşındı. Hiçbir mevcut özellik kaldırılmadı.
- [x] Sekmeler DOM'u yeniden oluşturmadan görünürlüğü değiştirir; görev işaretleri, fatura girişi, karşılaştırma ve açılmış kişisel kupon sekme değişiminde kaybolmaz. Ürün kartları kuponsuz konsept vitrini olarak kalır.
- [x] #bugun ve #fatura bağlantıları korunur; #gorevler, #urunler, #hakkinda eklenir. Geri/ileri gezinmesi, ok tuşları, Home/End, ARIA ilişkileri ve mobil yatay sekme gezinmesi desteklenir.
- [x] 34 otomatik test, benzersiz ID/sekme ilişkisi kontrolü, canlı görev/fatura/kupon korunması ve masaüstü/mobil görsel kontrolü geçti.

## Örnek kullanıcı girişi — 12 Ekim 2026

- [x] Üstte “Demo giriş” butonu ve örnek kullanıcı Deniz Yılmaz ile giriş penceresi; isteğe bağlı görünen ad değişikliği. Gerçek şifre/e-posta veya kimlik doğrulama yok; açık demo açıklaması.
- [x] Girişten sonra üstte kullanıcı adı ve DEMO etiketi; profil penceresinde mevcut görev/fatura özeti ve faturaya geçiş. Yeni sahte tüketim sonucu veya kupon üretilmez.
- [x] Demo profil aynı tarayıcıda yenileme sonrası korunur; çıkış yalnızca demo profili kapatır, mevcut faturaları ve görevleri silmez. Bunun ortak yerel demo hafızası olduğu belirtilir.
- [x] Mobil uyumlu ve klavyeyle kullanılabilir modal; giriş/çıkış, saklama ve geçersiz değer testleri.

## Five-task milestone and category-matched reward

- [x] At five completed task checkboxes, show a larger purple/gold milestone with “Milestone Reward Unlocked” and “5 Badges Earned — Special Reward Unlocked.” Treat tasks as participation badges for this demo; keep the eight-task daily card unchanged and do not grant a bill coupon from task checks alone.
- [x] Eligible bill comparison defaults to CleanCycle, PureWave or SparkleWash according to strongest self-reported completed habit category, using deterministic rotation on ties/no habit signal. Clearly explain bills verify total reduction only, not appliance-level attribution. Preserve hidden personal rewards, copy buttons and 5%/10% consumption tiers.

Quick verification: all 45 tests pass. Live UI confirmed four tasks stays locked, five shows the special milestone, eight retains the daily badge, and the same 12→10 m³ comparison yields CleanCycle/PureWave/SparkleWash codes for the corresponding reported habits. Test storage was restored.

## Marka bazında farklı indirimler — 12 Ekim 2026

- [x] Doğrulanan tüketim düşüşü %5–10 altında / %10+ olduğunda marka indirimleri sırasıyla BrightSmile %10/%20, PureWave %12/%22, CleanCycle %15/%25, SparkleWash %8/%18 olur. %5 altında kupon yok; ürün vitrini kuponsuz ve kişisel ödül başlangıçta gizli kalır.
- [x] Marka değiştirilince kupon kodu, indirim ve seçilen markanın demo politika açıklaması birlikte güncellenir. SAVE kısmı indirim yüzdesini değil tüketim düşüşünü belirtir. Kopyalama ve kategori önerisi korunur.

46 test geçti. Canlı sayfada iki tasarruf seviyesinde dört farklı marka oranı ve seçili politika açıklaması doğrulandı; test kayıtları geri yüklendi.
