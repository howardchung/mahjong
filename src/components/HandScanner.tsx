import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlowerCode,
  FLOWER_TILES,
  sortTiles,
  STANDARD_TILES,
  TileCode,
  TILE_MAP,
  WindIndex,
} from "../mahjong/tiles";
import {
  DEFAULT_SCORING_CONTEXT,
  scoreOldHongKongHand,
  ScoringContext,
} from "../mahjong/scoring";
import {
  detectMahjongTiles,
  drawDetectionsOnCanvas,
  TileDetection,
} from "../mahjong/vision";
import { TileChip } from "./TileChip";

interface HandScannerProps {
  defaultRoundWind: WindIndex;
  defaultSeatWind: WindIndex;
  onApplyScore: (fan: number, isSelfDraw: boolean) => void;
}

interface ScannedTile {
  key: string;
  code: TileCode;
  confidence?: number;
}

const WIND_LABELS = ["East 東", "South 南", "West 西", "North 北"];

const SAMPLE_HANDS: {
  name: string;
  tiles: TileCode[];
  flowers?: FlowerCode[];
  isSelfDraw?: boolean;
}[] = [
  {
    name: "Pure One Suit + Self-Draw (8 Fan)",
    tiles: [
      "1m", "2m", "3m",
      "4m", "5m", "6m",
      "7m", "8m", "9m",
      "2m", "2m", "2m",
      "5m", "5m",
    ],
    isSelfDraw: true,
  },
  {
    name: "Mixed One Suit + All Pungs + Red Dragon (7 Fan)",
    tiles: [
      "1p", "1p", "1p",
      "5p", "5p", "5p",
      "9p", "9p", "9p",
      "7z", "7z", "7z",
      "3p", "3p",
    ],
  },
  {
    name: "Big Three Dragons + Mixed Suit (11 Fan)",
    tiles: [
      "5z", "5z", "5z",
      "6z", "6z", "6z",
      "7z", "7z", "7z",
      "2s", "3s", "4s",
      "8s", "8s",
    ],
  },
  {
    name: "Thirteen Orphans (13 Fan Limit)",
    tiles: [
      "1m", "9m", "1p", "9p", "1s", "9s",
      "1z", "2z", "3z", "4z", "5z", "6z", "7z",
      "1m",
    ],
  },
];

let nextTileKey = 1;
const makeTile = (code: TileCode, confidence?: number): ScannedTile => ({
  key: `t-${nextTileKey++}`,
  code,
  confidence,
});

export const HandScanner: React.FC<HandScannerProps> = ({
  defaultRoundWind,
  defaultSeatWind,
  onApplyScore,
}) => {
  const [tiles, setTiles] = useState<ScannedTile[]>([]);
  const [context, setContext] = useState<ScoringContext>({
    ...DEFAULT_SCORING_CONTEXT,
    roundWind: defaultRoundWind,
    seatWind: defaultSeatWind,
  });

  // Sync winds when scoreboard round or selected winner changes
  useEffect(() => {
    setContext((prev) => ({
      ...prev,
      roundWind: defaultRoundWind,
      seatWind: defaultSeatWind,
    }));
  }, [defaultRoundWind, defaultSeatWind]);

  // Vision / camera state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [detections, setDetections] = useState<TileDetection[]>([]);

  // Live camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Offscreen source image & visible annotated canvas
  const sourceImageRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Tile editor state: null = closed, "add" = adding new tile, string = replacing tile with key
  const [editorMode, setEditorMode] = useState<null | "add" | string>(null);

  // Stop live camera on unmount
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Re-draw annotated canvas whenever detections or photo changes
  useEffect(() => {
    if (hasPhoto && sourceImageRef.current && previewCanvasRef.current) {
      drawDetectionsOnCanvas(
        previewCanvasRef.current,
        sourceImageRef.current,
        detections
      );
    }
  }, [hasPhoto, detections]);

  const runDetection = useCallback(
    async (
      source: HTMLImageElement | HTMLCanvasElement,
      threshold: number
    ) => {
      setIsScanning(true);
      setScanError("");
      setScanStatus("Running YOLOv11n tile detector in browser...");
      try {
        const result = await detectMahjongTiles(source, {
          confThreshold: threshold,
          iouThreshold: 0.45,
        });
        sourceImageRef.current = source;
        setHasPhoto(true);
        setDetections(result.detections);
        setTiles(result.detections.map((d) => makeTile(d.tile, d.confidence)));
        setScanStatus(
          `Detected ${result.detections.length} tile${
            result.detections.length === 1 ? "" : "s"
          } in ${result.inferenceMs}ms`
        );
        setEditorMode(null);
      } catch (err) {
        console.error("Mahjong CV error:", err);
        setScanError(
          err instanceof Error
            ? `Detection failed: ${err.message}`
            : "Detection failed. You can still enter tiles manually below."
        );
        setScanStatus("");
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    stopCamera();
    setScanError("");
    setScanStatus("Loading photo...");

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      await runDetection(img, confThreshold);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setScanError("Could not read image file.");
      setScanStatus("");
    };
    img.src = url;
  };

  const openLiveCamera = async () => {
    setScanError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError(
        'Live camera preview requires HTTPS. Use "Take Photo" on mobile instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setScanError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Try "Take Photo" instead.`
          : 'Camera unavailable. Try "Take Photo" instead.'
      );
    }
  };

  const captureFromLiveCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const frame = document.createElement("canvas");
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const ctx = frame.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    stopCamera();
    await runDetection(frame, confThreshold);
  };

  const handleThresholdChange = async (newVal: number) => {
    setConfThreshold(newVal);
    if (sourceImageRef.current && !isScanning) {
      await runDetection(sourceImageRef.current, newVal);
    }
  };

  const loadSampleHand = (idx: number) => {
    const sample = SAMPLE_HANDS[idx];
    if (!sample) return;
    stopCamera();
    sourceImageRef.current = null;
    setHasPhoto(false);
    setDetections([]);
    setScanError("");
    setScanStatus(`Loaded sample: ${sample.name}`);
    setTiles(sample.tiles.map((c) => makeTile(c)));
    setContext((prev) => ({
      ...prev,
      isSelfDraw: Boolean(sample.isSelfDraw),
      flowers: sample.flowers ?? [],
    }));
    setEditorMode(null);
  };

  const handlePickTile = (code: TileCode) => {
    if (editorMode === "add") {
      setTiles((prev) => [...prev, makeTile(code)]);
    } else if (editorMode) {
      setTiles((prev) =>
        prev.map((t) =>
          t.key === editorMode ? { ...t, code, confidence: undefined } : t
        )
      );
      setEditorMode(null);
    }
  };

  const handleDeleteSelectedTile = () => {
    if (!editorMode || editorMode === "add") return;
    setTiles((prev) => prev.filter((t) => t.key !== editorMode));
    setEditorMode(null);
  };

  const toggleFlower = (code: FlowerCode) => {
    setContext((prev) => {
      const exists = prev.flowers.includes(code);
      return {
        ...prev,
        flowers: exists
          ? prev.flowers.filter((f) => f !== code)
          : [...prev.flowers, code],
      };
    });
  };

  const tileCodes = useMemo(() => tiles.map((t) => t.code), [tiles]);
  const scoreResult = useMemo(
    () => scoreOldHongKongHand(tileCodes, context),
    [tileCodes, context]
  );

  const selectedTileObj =
    editorMode && editorMode !== "add"
      ? tiles.find((t) => t.key === editorMode)
      : null;

  return (
    <section className="mj-card mj-scanner-card" aria-label="Hand Photo Scanner">
      <div className="mj-card-header">
        <div>
          <h2 className="mj-card-title">Scan Hand &amp; Auto-Score</h2>
          <p className="mj-scanner-sub">
            Old Hong Kong rules &middot; On-device YOLOv11n vision (no API key)
          </p>
        </div>
        <span className="mj-model-pill">ONNX CV</span>
      </div>

      {/* Hidden native mobile camera & photo library inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="mj-sr-only"
        onChange={handleFileSelected}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="mj-sr-only"
        onChange={handleFileSelected}
      />

      {/* Capture Action Buttons */}
      <div className="mj-scan-actions">
        <button
          type="button"
          className="mj-btn mj-scan-btn-primary"
          disabled={isScanning}
          onClick={() => cameraInputRef.current?.click()}
        >
          📷 Take Photo
        </button>
        <button
          type="button"
          className="mj-btn mj-btn-secondary"
          disabled={isScanning}
          onClick={() => uploadInputRef.current?.click()}
        >
          🖼️ Upload Photo
        </button>
        <button
          type="button"
          className="mj-btn mj-btn-secondary"
          disabled={isScanning}
          onClick={cameraOpen ? stopCamera : openLiveCamera}
        >
          {cameraOpen ? "Close Camera" : "🎥 Live View"}
        </button>
      </div>

      {/* Quick sample hands for testing */}
      <div className="mj-sample-row">
        <span className="mj-sample-label">Try sample:</span>
        <div className="mj-sample-chips">
          {SAMPLE_HANDS.map((s, idx) => (
            <button
              key={s.name}
              type="button"
              className="mj-mini-pill"
              onClick={() => loadSampleHand(idx)}
            >
              {s.name.split(" (")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Live Camera Viewfinder */}
      {cameraOpen && (
        <div className="mj-camera-box">
          <video
            ref={videoRef}
            className="mj-camera-video"
            playsInline
            muted
            autoPlay
          />
          <div className="mj-camera-guide" aria-hidden="true">
            <span>Align all 14 tiles inside the frame</span>
          </div>
          <div className="mj-camera-controls">
            <button
              type="button"
              className="mj-btn"
              onClick={captureFromLiveCamera}
            >
              Capture &amp; Scan
            </button>
            <button
              type="button"
              className="mj-btn mj-btn-secondary"
              onClick={stopCamera}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status & Errors */}
      {(isScanning || scanStatus) && (
        <div className="mj-scan-status">
          {isScanning && <span className="mj-spinner" aria-hidden="true" />}
          <span>{scanStatus}</span>
        </div>
      )}
      {scanError && <div className="mj-scan-error">{scanError}</div>}

      {/* Annotated Photo Preview */}
      {hasPhoto && (
        <div className="mj-photo-preview-wrap">
          <canvas ref={previewCanvasRef} className="mj-photo-canvas" />
          <div className="mj-conf-bar">
            <label htmlFor="conf-slider" className="mj-label">
              Detection Sensitivity ({Math.round(confThreshold * 100)}%)
            </label>
            <input
              id="conf-slider"
              type="range"
              className="mj-slider"
              min={0.15}
              max={0.75}
              step={0.05}
              value={confThreshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Recognized / Editable Tile Rack */}
      <div className="mj-rack-section">
        <div className="mj-rack-header">
          <span className="mj-label">
            Hand Tiles ({tiles.length}/14)
            {tiles.length > 0 && (
              <span className="mj-rack-tip"> &middot; Tap a tile to edit</span>
            )}
          </span>
          <div className="mj-rack-btns">
            <button
              type="button"
              className="mj-mini-pill mj-mini-pill-gold"
              onClick={() =>
                setEditorMode((prev) => (prev === "add" ? null : "add"))
              }
            >
              {editorMode === "add" ? "Done Adding" : "+ Add Tile"}
            </button>
            {tiles.length > 1 && (
              <button
                type="button"
                className="mj-mini-pill"
                onClick={() => {
                  const sorted = sortTiles(tiles.map((t) => t.code));
                  setTiles(sorted.map((c) => makeTile(c)));
                }}
              >
                Sort
              </button>
            )}
            {tiles.length > 0 && (
              <button
                type="button"
                className="mj-mini-pill mj-mini-pill-danger"
                onClick={() => {
                  setTiles([]);
                  setEditorMode(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mj-tile-rack">
          {tiles.length === 0 ? (
            <div className="mj-rack-empty">
              Take a photo of a winning hand, upload one, or tap{" "}
              <strong>+ Add Tile</strong> to build a hand manually.
            </div>
          ) : (
            tiles.map((t) => (
              <TileChip
                key={t.key}
                code={t.code}
                confidence={t.confidence}
                selected={editorMode === t.key}
                onClick={() =>
                  setEditorMode((prev) => (prev === t.key ? null : t.key))
                }
              />
            ))
          )}
        </div>

        {/* Inline Tile Picker */}
        {editorMode !== null && (
          <div className="mj-picker-panel">
            <div className="mj-picker-header">
              <span className="mj-picker-title">
                {editorMode === "add"
                  ? "Tap tiles to add to hand:"
                  : `Replace ${
                      selectedTileObj
                        ? `${TILE_MAP[selectedTileObj.code].zh} (${
                            TILE_MAP[selectedTileObj.code].name
                          })`
                        : "tile"
                    }:`}
              </span>
              <div className="mj-picker-actions">
                {editorMode !== "add" && (
                  <button
                    type="button"
                    className="mj-btn mj-btn-danger-xs"
                    onClick={handleDeleteSelectedTile}
                  >
                    Remove Tile
                  </button>
                )}
                <button
                  type="button"
                  className="mj-mini-pill"
                  onClick={() => setEditorMode(null)}
                >
                  Close
                </button>
              </div>
            </div>
            {(["m", "p", "s", "z"] as const).map((suit) => (
              <div key={suit} className="mj-picker-row">
                {STANDARD_TILES.filter((t) => t.suit === suit).map((t) => (
                  <TileChip
                    key={t.code}
                    code={t.code}
                    compact
                    onClick={() => handlePickTile(t.code)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flowers & Seasons Selector */}
      <div className="mj-options-block">
        <div className="mj-options-row-between">
          <label className="mj-check-pill">
            <input
              type="checkbox"
              checked={context.useFlowers}
              onChange={(e) =>
                setContext((prev) => ({
                  ...prev,
                  useFlowers: e.target.checked,
                }))
              }
            />
            <span>Flowers &amp; Seasons (帶花)</span>
          </label>
          {context.useFlowers && (
            <span className="mj-card-subtitle">
              {context.flowers.length === 0
                ? "None selected (+1 No Flowers)"
                : `${context.flowers.length} selected`}
            </span>
          )}
        </div>
        {context.useFlowers && (
          <div className="mj-flower-grid">
            {FLOWER_TILES.map((f) => {
              const active = context.flowers.includes(f.code);
              const isSeatMatch = f.seat === context.seatWind;
              return (
                <button
                  key={f.code}
                  type="button"
                  className={`mj-flower-btn ${
                    active ? "mj-flower-btn-active" : ""
                  } ${isSeatMatch ? "mj-flower-btn-seat" : ""}`}
                  onClick={() => toggleFlower(f.code)}
                  title={`${f.name} (${f.zh}) — Seat ${f.number}${
                    isSeatMatch ? " (Your Seat!)" : ""
                  }`}
                >
                  <span className="mj-flower-num">{f.number}</span>
                  <span className="mj-flower-zh">{f.zh}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hand Context (Winds, Win Conditions, Max Fan) */}
      <div className="mj-options-block">
        <div className="mj-context-selects">
          <div className="mj-field">
            <label className="mj-label" htmlFor="scanner-round-wind">
              Round Wind (圈風)
            </label>
            <select
              id="scanner-round-wind"
              className="mj-select"
              value={context.roundWind}
              onChange={(e) =>
                setContext((prev) => ({
                  ...prev,
                  roundWind: Number(e.target.value) as WindIndex,
                }))
              }
            >
              {WIND_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="mj-field">
            <label className="mj-label" htmlFor="scanner-seat-wind">
              Seat Wind (門風)
            </label>
            <select
              id="scanner-seat-wind"
              className="mj-select"
              value={context.seatWind}
              onChange={(e) =>
                setContext((prev) => ({
                  ...prev,
                  seatWind: Number(e.target.value) as WindIndex,
                }))
              }
            >
              {WIND_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="mj-field">
            <label className="mj-label" htmlFor="scanner-max-fan">
              Max Limit
            </label>
            <select
              id="scanner-max-fan"
              className="mj-select"
              value={context.maxFan}
              onChange={(e) =>
                setContext((prev) => ({
                  ...prev,
                  maxFan: Number(e.target.value),
                }))
              }
            >
              <option value={8}>8 Fan Limit</option>
              <option value={10}>10 Fan Limit</option>
              <option value={13}>13 Fan Limit</option>
            </select>
          </div>
        </div>

        <div className="mj-toggle-pills">
          {(
            [
              ["isSelfDraw", "Self-Draw 自摸 (+1)"],
              ["isConcealed", "Concealed 門前清 (+1)"],
              ["isLastTile", "Last Tile 海底 (+1)"],
              ["isKongReplacement", "Kong Win 槓上開花 (+1)"],
              ["isRobbingKong", "Robbing Kong 搶槓 (+1)"],
              ["isHeavensBlessing", "Heaven 天胡 (13)"],
              ["isEarthsBlessing", "Earth 地胡 (13)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mj-check-pill">
              <input
                type="checkbox"
                checked={context[key]}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Score Result */}
      {tiles.length > 0 && (
        <div
          className={`mj-result-box ${
            scoreResult.valid ? "mj-result-valid" : "mj-result-invalid"
          }`}
        >
          {scoreResult.valid ? (
            <>
              <div className="mj-result-top">
                <div>
                  <div className="mj-result-label">Old Hong Kong Score</div>
                  <div className="mj-result-fan">
                    {scoreResult.totalFan} Fan
                    {scoreResult.capped && (
                      <span className="mj-result-cap">
                        {" "}
                        (capped from {scoreResult.rawFan})
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="mj-btn"
                  onClick={() =>
                    onApplyScore(scoreResult.totalFan, context.isSelfDraw)
                  }
                >
                  Apply {scoreResult.totalFan} Fan ↑
                </button>
              </div>

              {/* Fan Breakdown List */}
              <ul className="mj-fan-list">
                {scoreResult.items.map((item, idx) => (
                  <li key={`${item.name}-${idx}`} className="mj-fan-list-item">
                    <span>
                      <strong className="mj-fan-zh">{item.zh}</strong>{" "}
                      <span className="mj-fan-en">{item.name}</span>
                    </span>
                    <span className="mj-fan-pts">
                      {item.isLimit
                        ? `${item.fan} Fan (Limit)`
                        : item.fan === 0
                          ? "0 Fan"
                          : `+${item.fan}`}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Parsed Melds Preview */}
              {scoreResult.decomposition &&
                scoreResult.decomposition.melds.length > 0 && (
                  <div className="mj-melds-preview">
                    <span className="mj-melds-label">Parsed Melds:</span>
                    <div className="mj-melds-groups">
                      {scoreResult.decomposition.melds.map((m, idx) => (
                        <div key={idx} className="mj-meld-group">
                          {m.tiles.map((c, j) => (
                            <span
                              key={j}
                              className={`mj-mini-tile ${TILE_MAP[c].colorClass}`}
                            >
                              {TILE_MAP[c].zh}
                            </span>
                          ))}
                        </div>
                      ))}
                      <div className="mj-meld-group mj-meld-pair">
                        {scoreResult.decomposition.pair.map((c, j) => (
                          <span
                            key={j}
                            className={`mj-mini-tile ${TILE_MAP[c].colorClass}`}
                          >
                            {TILE_MAP[c].zh}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </>
          ) : (
            <div className="mj-result-error-msg">
              <strong>Not a complete winning hand yet:</strong>{" "}
              {scoreResult.reason}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
