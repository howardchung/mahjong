import * as ort from "onnxruntime-web/wasm";
import ortWasmMjsUrl from "../ort/ort-wasm-simd-threaded.mjs?url";
import { normalizeModelLabel, TileCode, TILE_MAP } from "./tiles";

export const MODEL_URL = "/models/mahjong-yolon.onnx";
export const INPUT_SIZE = 640;

// Exact class order embedded in nikmomo/Mahjong-YOLO mahjong-yolon-best.onnx
export const YOLO_CLASS_NAMES: readonly string[] = [
  "1m", "1p", "1s", "1z",
  "2m", "2p", "2s", "2z",
  "3m", "3p", "3s", "3z",
  "4m", "4p", "4s", "4z",
  "5m", "5p", "5s", "5z",
  "6m", "6p", "6s", "6z",
  "7m", "7p", "7s", "7z",
  "8m", "8p", "8s",
  "9m", "9p", "9s",
  "0m", "0p", "0s",
];

export interface TileDetection {
  id: string;
  tile: TileCode;
  rawLabel: string;
  confidence: number;
  /** Bounding box in original image pixel coordinates */
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface DetectionResult {
  detections: TileDetection[];
  inferenceMs: number;
  imageWidth: number;
  imageHeight: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

export function getModelSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths = {
      mjs: ortWasmMjsUrl,
      wasm: "/ort/ort-wasm-simd-threaded.wasm",
    };
    ort.env.wasm.numThreads = 1;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

interface LetterboxResult {
  tensor: ort.Tensor;
  scale: number;
  padX: number;
  padY: number;
  origWidth: number;
  origHeight: number;
}

function preprocessImage(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): LetterboxResult {
  const origWidth =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
        ? source.naturalWidth || source.width
        : source.width;
  const origHeight =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
        ? source.naturalHeight || source.height
        : source.height;

  const scale = Math.min(INPUT_SIZE / origWidth, INPUT_SIZE / origHeight);
  const newW = Math.round(origWidth * scale);
  const newH = Math.round(origHeight * scale);
  const padX = Math.floor((INPUT_SIZE - newW) / 2);
  const padY = Math.floor((INPUT_SIZE - newH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not initialize 2D canvas context");

  // Standard YOLO letterbox padding color (114, 114, 114)
  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(source, 0, 0, origWidth, origHeight, padX, padY, newW, newH);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const planeSize = INPUT_SIZE * INPUT_SIZE;
  const floatData = new Float32Array(3 * planeSize);

  // Convert RGBA HWC [0..255] -> RGB CHW [0..1]
  for (let i = 0; i < planeSize; i++) {
    const px = i * 4;
    floatData[i] = data[px] / 255;
    floatData[planeSize + i] = data[px + 1] / 255;
    floatData[2 * planeSize + i] = data[px + 2] / 255;
  }

  const tensor = new ort.Tensor("float32", floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  return { tensor, scale, padX, padY, origWidth, origHeight };
}

function computeIoU(a: TileDetection["box"], b: TileDetection["box"]): number {
  const interX1 = Math.max(a.x1, b.x1);
  const interY1 = Math.max(a.y1, b.y1);
  const interX2 = Math.min(a.x2, b.x2);
  const interY2 = Math.min(a.y2, b.y2);
  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;

  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return interArea / (areaA + areaB - interArea + 1e-6);
}

function applyNms(
  candidates: TileDetection[],
  iouThreshold: number
): TileDetection[] {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const kept: TileDetection[] = [];

  for (const cand of sorted) {
    let suppressed = false;
    for (const prev of kept) {
      if (computeIoU(cand.box, prev.box) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      kept.push(cand);
    }
  }

  return kept;
}

/**
 * Sort tiles in natural reading order (top-to-bottom rows, left-to-right within each row).
 */
function sortDetectionsReadingOrder(detections: TileDetection[]): TileDetection[] {
  if (detections.length <= 1) return detections;
  const avgHeight =
    detections.reduce((s, d) => s + (d.box.y2 - d.box.y1), 0) / detections.length;
  const rowTolerance = avgHeight * 0.6;

  // Group into rows by vertical center
  const sortedByY = [...detections].sort(
    (a, b) => (a.box.y1 + a.box.y2) / 2 - (b.box.y1 + b.box.y2) / 2
  );
  const rows: TileDetection[][] = [];
  for (const det of sortedByY) {
    const cy = (det.box.y1 + det.box.y2) / 2;
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      rows.push([det]);
    } else {
      const rowCy =
        lastRow.reduce((s, d) => s + (d.box.y1 + d.box.y2) / 2, 0) / lastRow.length;
      if (Math.abs(cy - rowCy) <= rowTolerance) {
        lastRow.push(det);
      } else {
        rows.push([det]);
      }
    }
  }

  return rows.flatMap((row) =>
    row.sort((a, b) => (a.box.x1 + a.box.x2) / 2 - (b.box.x1 + b.box.x2) / 2)
  );
}

export async function detectMahjongTiles(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  options?: { confThreshold?: number; iouThreshold?: number }
): Promise<DetectionResult> {
  const confThreshold = options?.confThreshold ?? 0.35;
  const iouThreshold = options?.iouThreshold ?? 0.45;

  const session = await getModelSession();
  const prep = preprocessImage(source);

  const start = performance.now();
  const inputName = session.inputNames[0] ?? "images";
  const outputMap = await session.run({ [inputName]: prep.tensor });
  const inferenceMs = Math.round(performance.now() - start);

  const outputName = session.outputNames[0] ?? "output0";
  const outputTensor = outputMap[outputName];
  const dims = outputTensor.dims; // [1, 41, 8400]
  const data = outputTensor.data as Float32Array;

  const numChannels = dims[1];
  const numAnchors = dims[2];
  const numClasses = numChannels - 4;

  const candidates: TileDetection[] = [];

  for (let a = 0; a < numAnchors; a++) {
    let bestClass = -1;
    let bestScore = confThreshold;

    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numAnchors + a];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestClass === -1) continue;
    const rawLabel = YOLO_CLASS_NAMES[bestClass];
    if (!rawLabel) continue;
    const tile = normalizeModelLabel(rawLabel);
    if (!tile) continue;

    const cx = data[0 * numAnchors + a];
    const cy = data[1 * numAnchors + a];
    const w = data[2 * numAnchors + a];
    const h = data[3 * numAnchors + a];

    const x1 = Math.max(0, (cx - w / 2 - prep.padX) / prep.scale);
    const y1 = Math.max(0, (cy - h / 2 - prep.padY) / prep.scale);
    const x2 = Math.min(prep.origWidth, (cx + w / 2 - prep.padX) / prep.scale);
    const y2 = Math.min(prep.origHeight, (cy + h / 2 - prep.padY) / prep.scale);

    if (x2 - x1 < 4 || y2 - y1 < 4) continue;

    candidates.push({
      id: `det-${a}-${tile}`,
      tile,
      rawLabel,
      confidence: bestScore,
      box: { x1, y1, x2, y2 },
    });
  }

  const kept = applyNms(candidates, iouThreshold);
  const ordered = sortDetectionsReadingOrder(kept);

  return {
    detections: ordered,
    inferenceMs,
    imageWidth: prep.origWidth,
    imageHeight: prep.origHeight,
  };
}

/**
 * Draws the image and detected tile bounding boxes onto a target canvas.
 */
export function drawDetectionsOnCanvas(
  canvas: HTMLCanvasElement,
  source: HTMLImageElement | HTMLCanvasElement,
  detections: TileDetection[]
) {
  const width =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const height =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;

  // Limit canvas backing resolution for mobile memory safety
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const fontSize = Math.max(12, Math.round(canvas.width * 0.022));
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";

  for (const det of detections) {
    const x = det.box.x1 * scale;
    const y = det.box.y1 * scale;
    const w = (det.box.x2 - det.box.x1) * scale;
    const h = (det.box.y2 - det.box.y1) * scale;

    ctx.strokeStyle = "#e5b85c";
    ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.003));
    ctx.strokeRect(x, y, w, h);

    const meta = TILE_MAP[det.tile];
    const label = `${meta.zh} ${Math.round(det.confidence * 100)}%`;
    const metrics = ctx.measureText(label);
    const padX = 5;
    const padY = 3;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    const labelY = y - boxH >= 0 ? y - boxH : y;

    ctx.fillStyle = "rgba(7, 25, 18, 0.86)";
    ctx.fillRect(x, labelY, boxW, boxH);
    ctx.fillStyle = "#f5d07d";
    ctx.fillText(label, x + padX, labelY + padY);
  }
}
