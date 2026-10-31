OCR output used by `tests/bill-parser.test.mjs`. Each file holds the two passes the
page runs (`bill-image.mjs` preprocessing + Tesseract `tur`): pass 1 is the mild
contrast image in block mode (PSM 6), pass 2 the darker image in sparse mode (PSM 11).

- `iski-photo-ocr.json` – `public/sample-iski-bill.png` (phone photo of an İSKİ bill).
- `synthetic-a/b/c-ocr.json` – made-up bills in other layouts (labelled list, table
  with header row, short "Endeks 158 / 33 gün" lines), rendered, tilted, blurred and
  JPEG-compressed before OCR. The numbers are invented; no real customer data.
- `synthetic-b-browser-ocr.json` – the table bill as the page itself read it (header row lost).
- `holdout-d/e-*.json` – two layouts made *after* the parser rules were written and
  checked blind (different wording: "Önceki Sayaç Değeri", "Harcanan Su",
  "Okuma Aralığı … (31 gün)", "GÜN: 30", "Ekim/2026"). `holdout-e-blurry` is the
  same receipt too small and blurred to read; the parser must not guess there.
