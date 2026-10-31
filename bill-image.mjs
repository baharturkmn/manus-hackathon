// Prepares a bill photo for OCR in the browser. The photo never leaves the device.
//
// Bill labels are often printed in light blue or grey, which Tesseract misses on
// a plain greyscale photo. Taking the darkest colour channel turns coloured ink
// dark, a percentile contrast stretch removes the paper tint, and upscaling small
// photos gives the recogniser enough pixels per character. `gamma` > 1 darkens
// faint print further (used for the second, fallback pass).
export async function loadBillBitmap(file) {
  // 'from-image' applies the phone's EXIF rotation.
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export function prepareBillImage(bitmap, { gamma = 1, targetWidth = 2400, maxScale = 3 } = {}) {
  const scale = Math.max(1, Math.min(maxScale, targetWidth / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const count = pixels.length / 4;
  const darkest = new Uint8ClampedArray(count);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < count; i += 1) {
    const value = Math.min(pixels[4 * i], pixels[4 * i + 1], pixels[4 * i + 2]);
    darkest[i] = value;
    histogram[value] += 1;
  }
  const percentile = share => {
    let seen = 0;
    for (let value = 0; value < 256; value += 1) {
      seen += histogram[value];
      if (seen >= count * share) return value;
    }
    return 255;
  };
  const low = percentile(0.02);
  const high = Math.max(low + 1, percentile(0.98));
  const lookup = new Uint8ClampedArray(256);
  for (let value = 0; value < 256; value += 1) {
    const stretched = Math.min(1, Math.max(0, (value - low) / (high - low)));
    lookup[value] = Math.round(stretched ** gamma * 255);
  }
  for (let i = 0; i < count; i += 1) {
    const value = lookup[darkest[i]];
    pixels[4 * i] = value;
    pixels[4 * i + 1] = value;
    pixels[4 * i + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
