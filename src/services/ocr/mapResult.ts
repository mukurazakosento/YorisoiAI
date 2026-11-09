import type { NativeOcrBlock, NativeOcrResult } from 'yorisoi-mlkit-ocr';

import type {
  OcrBlock,
  OcrElement,
  OcrLine,
  OcrResult,
  PixelBounds,
  RelativeBounds,
} from './types';

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toRelative(
  box: PixelBounds,
  imageWidth?: number,
  imageHeight?: number,
): RelativeBounds | undefined {
  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
    return undefined;
  }

  return {
    left: clamp01(box.x / imageWidth),
    top: clamp01(box.y / imageHeight),
    right: clamp01((box.x + box.width) / imageWidth),
    bottom: clamp01((box.y + box.height) / imageHeight),
  };
}

function mapElement(
  text: string,
  box: PixelBounds,
  imageWidth?: number,
  imageHeight?: number,
): OcrElement {
  return {
    text,
    pixelBounds: box,
    bounds: toRelative(box, imageWidth, imageHeight),
  };
}

function mapLine(
  line: NativeOcrBlock['lines'][number],
  imageWidth?: number,
  imageHeight?: number,
): OcrLine {
  const box = line.boundingBox;
  return {
    text: line.text,
    pixelBounds: box,
    bounds: toRelative(box, imageWidth, imageHeight),
    elements: (line.elements ?? []).map((el) =>
      mapElement(el.text, el.boundingBox, imageWidth, imageHeight),
    ),
  };
}

function mapBlock(
  block: NativeOcrBlock,
  imageWidth?: number,
  imageHeight?: number,
): OcrBlock {
  const box = block.boundingBox;
  const lines = (block.lines ?? []).map((line) =>
    mapLine(line, imageWidth, imageHeight),
  );
  return {
    text: block.text,
    pixelBounds: box,
    bounds: toRelative(box, imageWidth, imageHeight),
    lines,
  };
}

/** ネイティブ結果をアプリ用の構造化 OCR 結果へ変換する。 */
export function mapNativeOcrResult(
  native: NativeOcrResult,
  imageSize?: { width: number; height: number },
): OcrResult {
  const width = imageSize?.width;
  const height = imageSize?.height;
  const blocks = (native.blocks ?? []).map((block) =>
    mapBlock(block, width, height),
  );
  const lines = blocks.flatMap((block) => block.lines);

  return {
    fullText: native.text ?? '',
    blocks,
    lines,
    imageSize:
      width && height && width > 0 && height > 0
        ? { width, height }
        : undefined,
    engine: native.engine === 'mlkit-japanese' ? 'mlkit-japanese' : 'unavailable',
  };
}

/**
 * AI に渡す位置の目安（相対位置）。画像は含めない。
 * 上 / まん中 / 下 のざっくり区分だけ返す。
 */
export function buildLayoutHints(result: OcrResult, maxLines = 12): string {
  if (result.lines.length === 0) {
    return '';
  }

  const labeled = result.lines.slice(0, maxLines).map((line) => {
    const top = line.bounds?.top;
    let place = '位置不明';
    if (typeof top === 'number') {
      if (top < 0.33) {
        place = '画面の上のほう';
      } else if (top < 0.66) {
        place = '画面のまん中あたり';
      } else {
        place = '画面の下のほう';
      }
    }
    const snippet = line.text.replace(/\s+/g, ' ').trim().slice(0, 40);
    return `・${place}: ${snippet}`;
  });

  return labeled.join('\n');
}
