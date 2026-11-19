import React from "react";
import { TileCode, TILE_MAP } from "../mahjong/tiles";

interface TileChipProps {
  code: TileCode;
  confidence?: number;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  title?: string;
}

export const TileChip: React.FC<TileChipProps> = ({
  code,
  confidence,
  selected = false,
  compact = false,
  onClick,
  title,
}) => {
  const meta = TILE_MAP[code];
  const isHonor = meta.suit === "z";

  return (
    <button
      type="button"
      className={`mj-tile-chip ${meta.colorClass} ${
        selected ? "mj-tile-chip-selected" : ""
      } ${compact ? "mj-tile-chip-compact" : ""}`}
      onClick={onClick}
      title={
        title ??
        `${meta.zh} (${meta.name})${
          confidence !== undefined ? ` — ${Math.round(confidence * 100)}%` : ""
        }`
      }
    >
      <span className={`mj-tile-top ${isHonor ? "mj-tile-honor" : ""}`}>
        {meta.topLabel}
      </span>
      {!isHonor && <span className="mj-tile-bottom">{meta.bottomLabel}</span>}
      {confidence !== undefined && (
        <span className="mj-tile-conf">{Math.round(confidence * 100)}</span>
      )}
    </button>
  );
};
