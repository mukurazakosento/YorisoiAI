/** Pixel bounding box in image coordinates (origin: top-left). */
export type NativeOcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NativeOcrElement = {
  text: string;
  boundingBox: NativeOcrBoundingBox;
};

export type NativeOcrLine = {
  text: string;
  boundingBox: NativeOcrBoundingBox;
  elements: NativeOcrElement[];
};

export type NativeOcrBlock = {
  text: string;
  boundingBox: NativeOcrBoundingBox;
  lines: NativeOcrLine[];
};

/** Raw result from the native Google ML Kit Japanese recognizer. */
export type NativeOcrResult = {
  text: string;
  blocks: NativeOcrBlock[];
  /** Engine identifier — always on-device; never a remote OCR service. */
  engine: 'mlkit-japanese' | 'unavailable';
};
