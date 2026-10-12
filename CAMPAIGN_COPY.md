# SuNöbeti campaign copy

## Pitch copy

SuNöbeti, İstanbul’da musluktan su akmaya devam ettiği için fark edilmeyen su krizini günlük hayata indiren canlı bir farkındalık kampanyasıdır. Her sabah suyu açtığımızda hayat normal görünür; oysa İSKİ’nin 12 Ekim 2026 ölçümünde İstanbul barajlarının genel ortalama doluluğu **%38,11** olarak açıklandı. [1] SuNöbeti bu görünmeyen farkı tek bir ekranda anlatır: musluktaki “su var” hissini, rezervdeki değişimle yan yana koyar ve sayıyı “bugün ne yapabilirim?” sorusuna bağlar. Apify Web Scraper ile doğrulanan MGM İstanbul görünümünde 13–17 Ekim için sağanak sinyali bulunduğu için prototip bugün panik üretmek yerine sakin bir **“Dikkatli Kal”** çağrısı yapıyor. [2]

## Social caption — current, truthful status

**Kritik Tasarruf Modu kontrolü:** Şu an aktif değil. İSKİ’nin 12 Ekim verisinde İstanbul barajları **%38,11** dolulukta; Apify ile doğrulanan MGM’nin 13–17 Ekim görünümünde sağanak sinyali var. Musluktan su akıyor diye rezervi unutmayalım: bugün bir küçük adım seç. #SuNöbeti

> “Critical Savings Mode active” ifadesini bugün kullanmak doğru olmaz; doğrulanmış %38,11 değeri 35% eşiğinin üzerinde. Prototip bu nedenle acil durum ilan etmek yerine mevcut durumu doğru biçimde gösteriyor.

## Data note

The official MGM city interface currently exposes a five-day forecast, not a literal seven-day city table. [2] SuNöbeti makes this visible and does not infer days six and seven; the seven-day critical gate remains conservative until a complete, verified forecast window is available. Recent İSKİ trend points embedded in the page are %38,42 (1 Oct), %38,93 (5 Oct), %38,64 (8 Oct), %38,64 (9 Oct), and %38,11 (12 Oct). [1] [3] [4] [5]

## Sources

[1]: https://www.cumhuriyet.com.tr/turkiye/iski-acikladi-12-ekim-istanbul-baraj-doluluk-orani-yuzde-kac-2545767 "12 October 2026 İSKİ reservoir occupancy report"
[2]: https://www.mgm.gov.tr/?il=Istanbul "MGM İstanbul city forecast"
[3]: https://www.hurriyet.com.tr/bilgi/galeri/barajlarda-son-durum-ne-iski-barajlari-doluluk-orani-yukseldi-mi-dustu-mu-iste-guncel-veriler-43325677 "1 October 2026 İSKİ reservoir occupancy report"
[4]: https://www.hurriyet.com.tr/bilgi/galeri/iski-baraj-doluluk-oranlari-8-ekim-2026-istanbul-baraj-doluluk-orani-son-durum-ne-yuzde-kac-oldu-43333883 "8 October 2026 İSKİ reservoir occupancy report"
[5]: https://www.cumhuriyet.com.tr/turkiye/iski-acikladi-9-ekim-istanbul-baraj-doluluk-orani-yuzde-kac-2545034 "9 October 2026 İSKİ reservoir occupancy report"

## Daily task and product-development note

The daily checklist now uses four practical, non-preachy habits: turn off the tap while brushing teeth; keep showers short; run the washing machine only for a full and necessary load; and, when hand-washing dishes, avoid leaving the tap running by collecting dishes and washing them together in the dishwasher. Each task has its own small inline visual: toothbrush, shower, washing machine, or dishwasher.

The partner section is a product-development concept, not a claim of endorsement or an active commercial partnership. It uses the fictional demo brands BrightSmile, PureWave, CleanCycle, and SparkleWash to show how product families could create reminders, packaging, routines, or small incentives around the daily habits. The displayed codes are prototype codes tied to the verified personal-savings result, not real redemption codes.

## New interaction layer

The prototype now includes a symbolic **Today’s Community Savings** counter. It starts from a clearly labelled baseline of 12,480 L and increases on the visitor’s device as habits are checked; it is not presented as a measured citywide total. A separate Pabuçdere callout highlights the provided single-dam value of **2.50%**, while the main chart continues to show the 38.11% general occupancy average.

After all eight habits are completed, SuNöbeti reveals a generated PNG badge card with the exact message **“I'm part of SuNöbeti today”** and the verified **38.11%** occupancy figure. The card can be downloaded or shared through the device’s native share sheet when supported.

## Bill OCR validation

The supplied low-resolution sample with the **SU FATURASI** header and **OKUMA BİLGİLERİ / FATURA BİLGİLERİ** table was tested through the upload flow. The parser populated **Toplam m³ = 8**, **Günlük m³ = 0,24**, **Dönem = 202002**, and **Gün Sayısı = 33**; it then calculated **7,27 m³/month** using `8 / 33 × 30`. Because the sample OCR is low-confidence, the UI labels the result as an estimate and keeps every field editable for user confirmation.


## Tooling used in the prototype

**Apify:** The prototype uses an Apify Web Scraper run against the official MGM Istanbul page. The run returned a successful dataset item with the page title “İstanbul İçin Hava Durumu”, five future rain-signal days (Salı–Cumartesi), and a non-secret evidence file at `public/data/apify-mgm-verification.json`; the footer exposes this verification path so the jury can inspect it.

**fal.ai:** fal.ai generation was checked for this task, but the connected account was blocked by its own `balance_exhausted` restriction. No fal.ai asset is claimed or presented as generated; the prototype keeps its existing CSS/SVG visuals rather than misrepresenting the tool usage.


## Bill history flow

The bill experience now uses one upload area instead of asking the user to upload “previous” and “current” bills side by side. A user uploads the current İSKİ bill, confirms or edits **Toplam m³** and **Gün Sayısı**, and the prototype compares it against the latest saved history record after normalizing both to 30 days. The current bill can then be saved as the next reference; the demo stores this history in browser storage to simulate a user database, while a production version would persist it to the account database.
