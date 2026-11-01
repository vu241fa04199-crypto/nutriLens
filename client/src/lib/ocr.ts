// Client-side OCR for nutrition labels.
// Tesseract.js runs fully in the browser (worker + WASM), assets are served
// from /tesseract so no third-party network calls are made at scan time.
import { createWorker } from 'tesseract.js';

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: number;
}

let workerPromise: Promise<any> | null = null;
let listener: ((p: OcrProgress) => void) | null = null;

export function setOcrProgressListener(fn: ((p: OcrProgress) => void) | null) {
  listener = fn;
}

const STATUS_COPY: Record<string, string> = {
  'loading tesseract core': 'Starting the label reader…',
  'initializing tesseract': 'Starting the label reader…',
  'loading language traineddata': 'Loading the English model (first scan only)…',
  'initializing api': 'Warming up…',
  'recognizing text': 'Reading pixels…',
};

function describe(status: string) {
  return STATUS_COPY[status] || 'Working…';
}

async function makeWorker() {
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tesseract/tessdata',
    gzip: true,
    cacheMethod: 'none',
    legacyCore: false,
    legacyLang: false,
    logger: (m: any) => {
      if (!listener) return;
      listener({ status: describe(String(m.status || '')), progress: Number(m.progress) || 0 });
    },
    errorHandler: (e: any) => console.error('[ocr]', e),
  });
  // Nutrition panels are a single block of small uniform text.
  await worker.setParameters({
    tessedit_pageseg_mode: '6' as any,
    preserve_interword_spaces: '1',
  });
  return worker;
}

export function getWorker() {
  if (!workerPromise) {
    workerPromise = makeWorker().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function warmUpOcr() {
  try {
    await getWorker();
  } catch {
    /* first real scan will surface the error */
  }
}

/* ------------------------------------------------------------------ image */
/**
 * Upscale + grayscale + contrast-stretch. Nutrition tables are tiny, low
 * contrast text, which is exactly what hurts OCR the most.
 */
async function preprocess(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const targetWidth = Math.min(2000, Math.max(1200, bitmap.width < 1200 ? bitmap.width * 2 : bitmap.width));
  const scale = targetWidth / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);

  // grayscale
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }

  // 2% / 98% percentile stretch
  const total = (d.length / 4) | 0;
  const lowCut = total * 0.02;
  const highCut = total * 0.98;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowCut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= highCut) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.max(0, Math.min(255, ((v - lo) / range) * 255));

  for (let i = 0; i < d.length; i += 4) {
    const v = lut[d[i]];
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(img, 0, 0);
  bitmap.close?.();
  return canvas;
}

/* -------------------------------------------------------------- text fix */
const NUTRIENT_LINE =
  /(energy|calorie|protein|fat|carbohydrate|carbs|sugar|fibre|fiber|sodium|salt|kcal|cholesterol)/i;

/**
 * Repair the mistakes OCR reliably makes on nutrition panels.
 * The `g` → `9` and `1` → `l` swaps are by far the most common: labels are
 * printed in a condensed font where the two glyphs look almost identical.
 */
export function cleanOcrText(raw: string) {
  let t = raw || '';
  t = t.replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)); // full-width digits
  t = t.replace(/[|¦]/g, ' ');
  t = t.replace(/(\d)\s*,\s*(\d)/g, '$1.$2'); // decimal comma

  const lines = t.split('\n').map((line) => {
    if (!NUTRIENT_LINE.test(line)) return line;
    let l = line;
    l = l.replace(/(\d)\.l(\d)/g, '$1.1$2'); // 2.l5 → 2.15
    l = l.replace(/(\d)\.I(\d)/g, '$1.1$2');
    l = l.replace(/(\d)[.,]l(?=[a-z ]|$)/gi, '$1.1'); // 2.lg → 2.1g
    l = l.replace(/(\d)[.,]I(?=[a-z ]|$)/g, '$1.1');
    l = l.replace(/(\d+\.\d)9(\s|$)/g, '$1g$2'); // 24.59 → 24.5g
    l = l.replace(/(\d)9(\s*(?:kcal|mg|g|ml)\b)/gi, '$1g$2'); // 6409mg → 640gmg guard
    l = l.replace(/(\d)\s*[iI|](\d)/g, '$1$2'); // 1|0 → 10
    l = l.replace(/(\d)([oO])(\s*(?:kcal|mg|g|ml)\b)/g, '$10$3'); // 1O g → 10 g
    l = l.replace(/(\d)\s+(g|mg|kcal|kj|ml)\b/gi, '$1$2'); // keep value+unit together
    return l;
  });

  t = lines.join('\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/* --------------------------------------------------------------- recognize */
export async function recognizeLabel(
  image: Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrResult> {
  const worker = await getWorker();
  const previous = listener;
  if (onProgress) listener = onProgress;
  try {
    const canvas = await preprocess(image);
    const { data } = await worker.recognize(canvas);
    const text = cleanOcrText(data.text || '');
    return {
      text,
      confidence: Math.round(data.confidence || 0),
      lines: text.split('\n').filter((l) => l.trim().length > 1).length,
    };
  } finally {
    listener = previous;
  }
}

export async function terminateOcr() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    /* ignore */
  } finally {
    workerPromise = null;
  }
}
