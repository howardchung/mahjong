export type Suit = "m" | "p" | "s" | "z" | "f";
export type WindIndex = 0 | 1 | 2 | 3; // 0: East, 1: South, 2: West, 3: North

export type TileCode =
  | "1m" | "2m" | "3m" | "4m" | "5m" | "6m" | "7m" | "8m" | "9m"
  | "1p" | "2p" | "3p" | "4p" | "5p" | "6p" | "7p" | "8p" | "9p"
  | "1s" | "2s" | "3s" | "4s" | "5s" | "6s" | "7s" | "8s" | "9s"
  | "1z" | "2z" | "3z" | "4z" | "5z" | "6z" | "7z";

export type FlowerCode =
  | "1f" | "2f" | "3f" | "4f" // Seasons: Spring, Summer, Autumn, Winter
  | "5f" | "6f" | "7f" | "8f"; // Flowers: Plum, Orchid, Chrysanthemum, Bamboo

export interface TileMeta {
  code: TileCode;
  suit: "m" | "p" | "s" | "z";
  rank: number; // 1-9 for suited, 1-4 winds, 5-7 dragons
  name: string;
  zh: string;
  topLabel: string;
  bottomLabel: string;
  unicode: string;
  colorClass: "tile-red" | "tile-green" | "tile-blue" | "tile-dark";
}

export interface FlowerMeta {
  code: FlowerCode;
  group: "season" | "flower";
  seat: WindIndex; // 0: East (1), 1: South (2), 2: West (3), 3: North (4)
  number: 1 | 2 | 3 | 4;
  name: string;
  zh: string;
  unicode: string;
}

const ZH_NUMS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export const STANDARD_TILES: TileMeta[] = [
  // Characters (Wan / 萬)
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    code: `${n}m` as TileCode,
    suit: "m" as const,
    rank: n,
    name: `${n} Wan`,
    zh: `${ZH_NUMS[n]}萬`,
    topLabel: ZH_NUMS[n],
    bottomLabel: "萬",
    unicode: String.fromCodePoint(0x1f007 + (n - 1)),
    colorClass: "tile-red" as const,
  })),
  // Dots / Circles (Tong / 筒)
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    code: `${n}p` as TileCode,
    suit: "p" as const,
    rank: n,
    name: `${n} Tong`,
    zh: `${ZH_NUMS[n]}筒`,
    topLabel: String(n),
    bottomLabel: "筒",
    unicode: String.fromCodePoint(0x1f019 + (n - 1)),
    colorClass: "tile-blue" as const,
  })),
  // Bamboo (Suo / 索)
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    code: `${n}s` as TileCode,
    suit: "s" as const,
    rank: n,
    name: `${n} Suo`,
    zh: `${ZH_NUMS[n]}索`,
    topLabel: String(n),
    bottomLabel: "索",
    unicode: String.fromCodePoint(0x1f010 + (n - 1)),
    colorClass: "tile-green" as const,
  })),
  // Winds (東 南 西 北)
  {
    code: "1z",
    suit: "z",
    rank: 1,
    name: "East Wind",
    zh: "東",
    topLabel: "東",
    bottomLabel: "E",
    unicode: "🀀",
    colorClass: "tile-dark",
  },
  {
    code: "2z",
    suit: "z",
    rank: 2,
    name: "South Wind",
    zh: "南",
    topLabel: "南",
    bottomLabel: "S",
    unicode: "🀁",
    colorClass: "tile-dark",
  },
  {
    code: "3z",
    suit: "z",
    rank: 3,
    name: "West Wind",
    zh: "西",
    topLabel: "西",
    bottomLabel: "W",
    unicode: "🀂",
    colorClass: "tile-dark",
  },
  {
    code: "4z",
    suit: "z",
    rank: 4,
    name: "North Wind",
    zh: "北",
    topLabel: "北",
    bottomLabel: "N",
    unicode: "🀃",
    colorClass: "tile-dark",
  },
  // Dragons (白 發 中)
  {
    code: "5z",
    suit: "z",
    rank: 5,
    name: "White Dragon",
    zh: "白",
    topLabel: "白",
    bottomLabel: "□",
    unicode: "🀆",
    colorClass: "tile-blue",
  },
  {
    code: "6z",
    suit: "z",
    rank: 6,
    name: "Green Dragon",
    zh: "發",
    topLabel: "發",
    bottomLabel: "G",
    unicode: "🀅",
    colorClass: "tile-green",
  },
  {
    code: "7z",
    suit: "z",
    rank: 7,
    name: "Red Dragon",
    zh: "中",
    topLabel: "中",
    bottomLabel: "R",
    unicode: "🀄",
    colorClass: "tile-red",
  },
];

export const TILE_MAP: Record<TileCode, TileMeta> = Object.fromEntries(
  STANDARD_TILES.map((t) => [t.code, t])
) as Record<TileCode, TileMeta>;

export const FLOWER_TILES: FlowerMeta[] = [
  { code: "1f", group: "season", seat: 0, number: 1, name: "Spring", zh: "春", unicode: "🀦" },
  { code: "2f", group: "season", seat: 1, number: 2, name: "Summer", zh: "夏", unicode: "🀧" },
  { code: "3f", group: "season", seat: 2, number: 3, name: "Autumn", zh: "秋", unicode: "🀨" },
  { code: "4f", group: "season", seat: 3, number: 4, name: "Winter", zh: "冬", unicode: "🀩" },
  { code: "5f", group: "flower", seat: 0, number: 1, name: "Plum", zh: "梅", unicode: "🀢" },
  { code: "6f", group: "flower", seat: 1, number: 2, name: "Orchid", zh: "蘭", unicode: "🀣" },
  { code: "7f", group: "flower", seat: 2, number: 3, name: "Chrysanthemum", zh: "菊", unicode: "🀤" },
  { code: "8f", group: "flower", seat: 3, number: 4, name: "Bamboo", zh: "竹", unicode: "🀥" },
];

export const FLOWER_MAP: Record<FlowerCode, FlowerMeta> = Object.fromEntries(
  FLOWER_TILES.map((f) => [f.code, f])
) as Record<FlowerCode, FlowerMeta>;

const TILE_ORDER: Record<TileCode, number> = Object.fromEntries(
  STANDARD_TILES.map((t, idx) => [t.code, idx])
) as Record<TileCode, number>;

export function sortTiles(tiles: TileCode[]): TileCode[] {
  return [...tiles].sort((a, b) => TILE_ORDER[a] - TILE_ORDER[b]);
}

export function normalizeModelLabel(label: string): TileCode | null {
  // Map Riichi red fives (0m, 0p, 0s) to standard 5m, 5p, 5s for HK Mahjong
  const normalized = label.replace(/^0([mps])$/, "5$1");
  if (normalized in TILE_MAP) {
    return normalized as TileCode;
  }
  return null;
}

export function isTerminal(code: TileCode): boolean {
  const t = TILE_MAP[code];
  return t.suit !== "z" && (t.rank === 1 || t.rank === 9);
}

export function isHonor(code: TileCode): boolean {
  return TILE_MAP[code].suit === "z";
}

export function isWind(code: TileCode): boolean {
  const t = TILE_MAP[code];
  return t.suit === "z" && t.rank >= 1 && t.rank <= 4;
}

export function isDragon(code: TileCode): boolean {
  const t = TILE_MAP[code];
  return t.suit === "z" && t.rank >= 5 && t.rank <= 7;
}

export function windIndexToTile(wind: WindIndex): TileCode {
  return `${wind + 1}z` as TileCode;
}
