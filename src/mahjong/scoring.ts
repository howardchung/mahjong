import {
  FlowerCode,
  FLOWER_MAP,
  isDragon,
  isHonor,
  isTerminal,
  isWind,
  STANDARD_TILES,
  TileCode,
  TILE_MAP,
  WindIndex,
  windIndexToTile,
} from "./tiles";

export interface Meld {
  type: "chow" | "pung" | "kong";
  tiles: TileCode[];
}

export interface HandDecomposition {
  melds: Meld[];
  pair: [TileCode, TileCode];
  special?: "thirteen-orphans" | "nine-gates";
}

export interface ScoringContext {
  roundWind: WindIndex;
  seatWind: WindIndex;
  isSelfDraw: boolean;
  isConcealed: boolean;
  isLastTile: boolean;
  isKongReplacement: boolean;
  isRobbingKong: boolean;
  isHeavensBlessing: boolean;
  isEarthsBlessing: boolean;
  useFlowers: boolean;
  flowers: FlowerCode[];
  maxFan: number; // typically 8, 10, or 13
}

export interface FanItem {
  name: string;
  zh: string;
  fan: number;
  isLimit?: boolean;
}

export interface ScoreResult {
  valid: boolean;
  reason?: string;
  totalFan: number;
  rawFan: number;
  capped: boolean;
  items: FanItem[];
  decomposition?: HandDecomposition;
}

export const DEFAULT_SCORING_CONTEXT: ScoringContext = {
  roundWind: 0,
  seatWind: 0,
  isSelfDraw: false,
  isConcealed: false,
  isLastTile: false,
  isKongReplacement: false,
  isRobbingKong: false,
  isHeavensBlessing: false,
  isEarthsBlessing: false,
  useFlowers: true,
  flowers: [],
  maxFan: 13,
};

const WIND_ZH = ["東", "南", "西", "北"];
const WIND_EN = ["East", "South", "West", "North"];

const THIRTEEN_ORPHAN_SET: TileCode[] = [
  "1m", "9m",
  "1p", "9p",
  "1s", "9s",
  "1z", "2z", "3z", "4z", "5z", "6z", "7z",
];

function buildCounts(tiles: TileCode[]): Record<TileCode, number> {
  const counts = {} as Record<TileCode, number>;
  for (const t of STANDARD_TILES) {
    counts[t.code] = 0;
  }
  for (const code of tiles) {
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

function isThirteenOrphans(tiles: TileCode[], counts: Record<TileCode, number>): boolean {
  if (tiles.length !== 14) return false;
  let pairCount = 0;
  for (const code of THIRTEEN_ORPHAN_SET) {
    const c = counts[code];
    if (c === 0) return false;
    if (c === 2) pairCount++;
    else if (c > 2) return false;
  }
  return pairCount === 1;
}

function isNineGates(tiles: TileCode[], counts: Record<TileCode, number>, isConcealed: boolean): boolean {
  if (!isConcealed || tiles.length !== 14) return false;
  const firstSuit = TILE_MAP[tiles[0]].suit;
  if (firstSuit === "z") return false;
  for (const t of tiles) {
    if (TILE_MAP[t].suit !== firstSuit) return false;
  }
  const required = [0, 3, 1, 1, 1, 1, 1, 1, 1, 3];
  let extra = 0;
  for (let r = 1; r <= 9; r++) {
    const c = counts[`${r}${firstSuit}` as TileCode];
    if (c < required[r]) return false;
    extra += c - required[r];
  }
  return extra === 1;
}

/**
 * Finds all valid decompositions of tiles into 4 melds (chow/pung/kong) + 1 pair.
 * Supports 14 tiles (0 kongs) up to 18 tiles (4 kongs).
 */
export function findDecompositions(tiles: TileCode[]): HandDecomposition[] {
  const kongsNeeded = tiles.length - 14;
  if (kongsNeeded < 0 || kongsNeeded > 4) return [];

  const counts = buildCounts(tiles);
  for (const code of Object.keys(counts) as TileCode[]) {
    if (counts[code] > 4) return [];
  }

  const results: HandDecomposition[] = [];
  const seenKeys = new Set<string>();

  const tileOrder = STANDARD_TILES.map((t) => t.code);

  function solveMelds(
    remCounts: Record<TileCode, number>,
    melds: Meld[],
    kongsLeft: number,
    startIdx: number,
    pair: [TileCode, TileCode]
  ) {
    // Advance to first tile with count > 0
    let idx = startIdx;
    while (idx < tileOrder.length && remCounts[tileOrder[idx]] === 0) {
      idx++;
    }

    if (idx === tileOrder.length) {
      if (melds.length === 4 && kongsLeft === 0) {
        const key =
          pair[0] +
          "|" +
          melds
            .map((m) => `${m.type}:${m.tiles.join(",")}`)
            .sort()
            .join(";");
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({
            melds: melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
            pair,
          });
        }
      }
      return;
    }

    if (melds.length >= 4) return;

    const code = tileOrder[idx];
    const meta = TILE_MAP[code];
    const count = remCounts[code];

    // Option 1: Kong (4 of a kind) if kongsLeft > 0
    if (kongsLeft > 0 && count >= 4) {
      remCounts[code] -= 4;
      melds.push({ type: "kong", tiles: [code, code, code, code] });
      solveMelds(remCounts, melds, kongsLeft - 1, idx, pair);
      melds.pop();
      remCounts[code] += 4;
    }

    // Option 2: Pung (3 of a kind)
    if (count >= 3) {
      remCounts[code] -= 3;
      melds.push({ type: "pung", tiles: [code, code, code] });
      solveMelds(remCounts, melds, kongsLeft, idx, pair);
      melds.pop();
      remCounts[code] += 3;
    }

    // Option 3: Chow (sequence of 3 in same numbered suit)
    if (meta.suit !== "z" && meta.rank <= 7) {
      const c2 = `${meta.rank + 1}${meta.suit}` as TileCode;
      const c3 = `${meta.rank + 2}${meta.suit}` as TileCode;
      if (remCounts[c2] > 0 && remCounts[c3] > 0) {
        remCounts[code] -= 1;
        remCounts[c2] -= 1;
        remCounts[c3] -= 1;
        melds.push({ type: "chow", tiles: [code, c2, c3] });
        solveMelds(remCounts, melds, kongsLeft, idx, pair);
        melds.pop();
        remCounts[code] += 1;
        remCounts[c2] += 1;
        remCounts[c3] += 1;
      }
    }
  }

  // Try each possible pair
  for (const code of tileOrder) {
    if (counts[code] >= 2) {
      counts[code] -= 2;
      solveMelds(counts, [], kongsNeeded, 0, [code, code]);
      counts[code] += 2;
    }
  }

  return results;
}

function scoreFlowers(context: ScoringContext): FanItem[] {
  if (!context.useFlowers) return [];
  const uniqueFlowers = Array.from(new Set(context.flowers));
  const count = uniqueFlowers.length;

  if (count === 0) {
    return [{ name: "No Flowers", zh: "無花", fan: 1 }];
  }
  if (count === 8) {
    return [{ name: "All Eight Flowers", zh: "八仙過海", fan: 8, isLimit: true }];
  }
  if (count === 7) {
    return [{ name: "Seven Flowers", zh: "七搶一", fan: 3 }];
  }

  const items: FanItem[] = [];
  const seasons = uniqueFlowers.filter((f) => FLOWER_MAP[f].group === "season");
  const flowers = uniqueFlowers.filter((f) => FLOWER_MAP[f].group === "flower");

  if (seasons.length === 4) {
    items.push({ name: "All Four Seasons", zh: "一台草", fan: 2 });
  } else {
    const seatSeason = seasons.find((f) => FLOWER_MAP[f].seat === context.seatWind);
    if (seatSeason) {
      items.push({
        name: `Seat Season (${FLOWER_MAP[seatSeason].name})`,
        zh: `正花 (${FLOWER_MAP[seatSeason].zh})`,
        fan: 1,
      });
    }
  }

  if (flowers.length === 4) {
    items.push({ name: "All Four Flowers", zh: "一台花", fan: 2 });
  } else {
    const seatFlower = flowers.find((f) => FLOWER_MAP[f].seat === context.seatWind);
    if (seatFlower) {
      items.push({
        name: `Seat Flower (${FLOWER_MAP[seatFlower].name})`,
        zh: `正花 (${FLOWER_MAP[seatFlower].zh})`,
        fan: 1,
      });
    }
  }

  return items;
}

function scoreDecomposition(
  tiles: TileCode[],
  decomp: HandDecomposition,
  context: ScoringContext
): ScoreResult {
  const items: FanItem[] = [];

  // --- Check Limit Hands First (Old Hong Kong) ---
  if (context.isHeavensBlessing) {
    items.push({ name: "Heaven's Blessing", zh: "天胡", fan: 13, isLimit: true });
  } else if (context.isEarthsBlessing) {
    items.push({ name: "Earth's Blessing", zh: "地胡", fan: 13, isLimit: true });
  } else if (decomp.special === "thirteen-orphans") {
    items.push({ name: "Thirteen Orphans", zh: "十三么", fan: 13, isLimit: true });
  } else if (decomp.special === "nine-gates") {
    items.push({ name: "Nine Gates", zh: "九蓮寶燈", fan: 10, isLimit: true });
  }

  if (items.length > 0) {
    const rawFan = items.reduce((s, i) => s + i.fan, 0);
    return {
      valid: true,
      totalFan: Math.min(rawFan, context.maxFan),
      rawFan,
      capped: rawFan > context.maxFan,
      items,
      decomposition: decomp,
    };
  }

  const pungsAndKongs = decomp.melds.filter((m) => m.type === "pung" || m.type === "kong");
  const kongs = decomp.melds.filter((m) => m.type === "kong");
  const chows = decomp.melds.filter((m) => m.type === "chow");

  const windPungs = pungsAndKongs.filter((m) => isWind(m.tiles[0]));
  const dragonPungs = pungsAndKongs.filter((m) => isDragon(m.tiles[0]));
  const pairIsWind = isWind(decomp.pair[0]);
  const pairIsDragon = isDragon(decomp.pair[0]);

  const allHonors = tiles.every((t) => isHonor(t));
  const allTerminals = tiles.every((t) => isTerminal(t));
  const allTerminalsOrHonors = tiles.every((t) => isTerminal(t) || isHonor(t));

  // Limit hands from standard melds
  if (windPungs.length === 4) {
    items.push({ name: "Big Four Winds", zh: "大四喜", fan: 13, isLimit: true });
  }
  if (kongs.length === 4) {
    items.push({ name: "All Kongs", zh: "十八羅漢", fan: 13, isLimit: true });
  }
  if (allHonors) {
    items.push({ name: "All Honors", zh: "字一色", fan: 10, isLimit: true });
  }
  if (allTerminals) {
    items.push({ name: "All Terminals", zh: "清么九", fan: 10, isLimit: true });
  }

  if (items.length > 0) {
    const rawFan = items.reduce((s, i) => s + i.fan, 0);
    return {
      valid: true,
      totalFan: Math.min(rawFan, context.maxFan),
      rawFan,
      capped: rawFan > context.maxFan,
      items,
      decomposition: decomp,
    };
  }

  // --- Standard & High-Value Old Hong Kong Patterns ---

  // 1. Dragons: Big Three Dragons (8), Small Three Dragons (5), or Individual Dragon Pungs (1 each)
  if (dragonPungs.length === 3) {
    items.push({ name: "Big Three Dragons", zh: "大三元", fan: 8 });
  } else if (dragonPungs.length === 2 && pairIsDragon) {
    items.push({ name: "Small Three Dragons", zh: "小三元", fan: 5 });
  } else {
    for (const dp of dragonPungs) {
      const meta = TILE_MAP[dp.tiles[0]];
      items.push({
        name: `${meta.name} Pung`,
        zh: `${meta.zh}刻`,
        fan: 1,
      });
    }
  }

  // 2. Winds: Small Four Winds (6), or Round Wind / Seat Wind Pungs (1 each)
  if (windPungs.length === 3 && pairIsWind) {
    items.push({ name: "Small Four Winds", zh: "小四喜", fan: 6 });
  } else {
    const roundTile = windIndexToTile(context.roundWind);
    const seatTile = windIndexToTile(context.seatWind);
    const hasRoundWind = windPungs.some((m) => m.tiles[0] === roundTile);
    const hasSeatWind = windPungs.some((m) => m.tiles[0] === seatTile);
    if (hasRoundWind) {
      items.push({
        name: `Round Wind (${WIND_EN[context.roundWind]})`,
        zh: `圈風 (${WIND_ZH[context.roundWind]})`,
        fan: 1,
      });
    }
    if (hasSeatWind) {
      items.push({
        name: `Seat Wind (${WIND_EN[context.seatWind]})`,
        zh: `門風 (${WIND_ZH[context.seatWind]})`,
        fan: 1,
      });
    }
  }

  // 3. Suits: Pure One Suit (7) or Mixed One Suit (3)
  const numberedSuits = new Set(
    tiles.filter((t) => !isHonor(t)).map((t) => TILE_MAP[t].suit)
  );
  const hasHonors = tiles.some((t) => isHonor(t));
  if (numberedSuits.size === 1 && !hasHonors) {
    items.push({ name: "Pure One Suit", zh: "清一色", fan: 7 });
  } else if (numberedSuits.size === 1 && hasHonors) {
    items.push({ name: "Mixed One Suit", zh: "混一色", fan: 3 });
  }

  // 4. Hand Structure: Mixed Terminals (4), All Pungs (3), or All Chows / Common Hand (1)
  if (allTerminalsOrHonors && !allHonors && !allTerminals) {
    items.push({ name: "Mixed Terminals", zh: "混么九", fan: 4 });
  } else if (pungsAndKongs.length === 4) {
    items.push({ name: "All Pungs", zh: "對對胡", fan: 3 });
  } else if (chows.length === 4) {
    items.push({ name: "Common Hand (All Chows)", zh: "平胡", fan: 1 });
  }

  // 5. Win conditions
  if (context.isConcealed) {
    items.push({ name: "Concealed Hand", zh: "門前清", fan: 1 });
  }
  if (context.isSelfDraw) {
    items.push({ name: "Self-Draw", zh: "自摸", fan: 1 });
  }
  if (context.isLastTile) {
    items.push({ name: "Win on Last Tile", zh: "海底撈月", fan: 1 });
  }
  if (context.isKongReplacement) {
    items.push({ name: "Win on Kong Replacement", zh: "槓上開花", fan: 1 });
  }
  if (context.isRobbingKong) {
    items.push({ name: "Robbing the Kong", zh: "搶槓", fan: 1 });
  }

  // 6. Flowers & Seasons
  const flowerItems = scoreFlowers(context);
  items.push(...flowerItems);

  // Chicken Hand if 0 fan
  const rawFan = items.reduce((sum, item) => sum + item.fan, 0);
  if (rawFan === 0) {
    items.push({ name: "Chicken Hand", zh: "雞胡", fan: 0 });
  }

  return {
    valid: true,
    totalFan: Math.min(rawFan, context.maxFan),
    rawFan,
    capped: rawFan > context.maxFan,
    items,
    decomposition: decomp,
  };
}

/**
 * Scores a Mahjong hand according to Old Hong Kong (香港舊章) scoring rules.
 */
export function scoreOldHongKongHand(
  tiles: TileCode[],
  context: ScoringContext
): ScoreResult {
  if (tiles.length < 14) {
    return {
      valid: false,
      reason: `Need at least 14 tiles to score (currently ${tiles.length}). Tap "+ Add Tile" to fill in any missed tiles.`,
      totalFan: 0,
      rawFan: 0,
      capped: false,
      items: [],
    };
  }
  if (tiles.length > 18) {
    return {
      valid: false,
      reason: `Too many tiles (${tiles.length}). A winning hand has 14 tiles (or up to 18 with Kongs). Tap extra tiles to remove them.`,
      totalFan: 0,
      rawFan: 0,
      capped: false,
      items: [],
    };
  }

  const counts = buildCounts(tiles);
  for (const [code, c] of Object.entries(counts)) {
    if (c > 4) {
      const meta = TILE_MAP[code as TileCode];
      return {
        valid: false,
        reason: `Too many copies of ${meta.zh} (${meta.name}): ${c} found (max 4).`,
        totalFan: 0,
        rawFan: 0,
        capped: false,
        items: [],
      };
    }
  }

  // Special hand: Thirteen Orphans
  if (isThirteenOrphans(tiles, counts)) {
    const pairTile = THIRTEEN_ORPHAN_SET.find((c) => counts[c] === 2)!;
    return scoreDecomposition(
      tiles,
      { melds: [], pair: [pairTile, pairTile], special: "thirteen-orphans" },
      context
    );
  }

  // Special hand: Nine Gates (concealed)
  if (isNineGates(tiles, counts, context.isConcealed)) {
    const decomps = findDecompositions(tiles);
    const baseDecomp = decomps[0] ?? { melds: [], pair: [tiles[0], tiles[0]] };
    return scoreDecomposition(
      tiles,
      { ...baseDecomp, special: "nine-gates" },
      context
    );
  }

  // Standard 4 melds + 1 pair decompositions
  const decomps = findDecompositions(tiles);
  if (decomps.length === 0) {
    return {
      valid: false,
      reason:
        "Tiles do not form a valid winning hand (4 melds + 1 pair). Tap any misread tile to correct it.",
      totalFan: 0,
      rawFan: 0,
      capped: false,
      items: [],
    };
  }

  let best: ScoreResult | null = null;
  for (const decomp of decomps) {
    const scored = scoreDecomposition(tiles, decomp, context);
    if (!best || scored.rawFan > best.rawFan) {
      best = scored;
    }
  }

  return best!;
}
