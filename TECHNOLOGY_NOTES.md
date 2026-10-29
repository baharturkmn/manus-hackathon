# SuNöbeti — jury technology notes

## What was actually used

### Apify

- **Actor:** `apify/web-scraper`
- **Source:** official MGM Istanbul page (`https://www.mgm.gov.tr/?il=Istanbul`)
- **Result:** successful dataset item with the title `İstanbul İçin Hava Durumu` and five future rain-signal days.
- **How it affects the product:** the returned signal supports the calm “Dikkatli Kal” state and the conservative seven-day rule; the site does not invent days six and seven.
- **Evidence in the prototype:** `/data/apify-mgm-verification.json`, linked from the footer under `VERIFICATION PIPELINE`.

### Live reservoir data (not Apify)

İSKİ and İBB open data only accept Turkish IPs; requests from GitHub runners, Apify Web Scraper and Apify Proxy (free plan: 403) all failed. The hourly job therefore reads İSKİ's published figures from dolulukorani.com, which republishes them; see README. Apify is used only for the 12 October MGM verification above.

### fal.ai

The fal.ai account check returned an account-level `balance_exhausted` restriction, so no image generation was completed. The prototype does not claim a fal.ai-generated asset. If the account is restored, the intended meaningful use is one original no-text hero/product visual for the partner-product shelf, then saving that asset under `public/` and citing it in the page provenance.

## Jury answer in one sentence

> “Apify Web Scraper doğrulamasıyla MGM’nin İstanbul yağış sinyalini aldık; bu sinyal SuNöbeti’nin kritik mod kararını muhafazakâr biçimde etkiliyor. fal.ai’ı denedik ancak bağlı hesap üretim kısıtına takıldığı için onu kullanmış gibi göstermedik.”
