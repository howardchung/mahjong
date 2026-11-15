import React, { useState } from "react";
import "./App.css";

const scoreTable = [0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const winds = ["East", "South", "West", "North"];
const windChars = ["東", "南", "西", "北"];
// East: 東 (dōng)
// South: 南 (nán)
// West: 西 (xī)
// North: 北 (běi)

type Mods = {
  winner: string;
  discarder: string;
  penalty: string;
  points: number;
  // fakeWin: boolean;
};

type GameState = { playerNames: Array<string>; deltas: Array<Array<number>> };

let defaultState = {
  playerNames: ["East", "South", "West", "North"],
  deltas: [],
};
const savedState = window.localStorage.getItem("mahjong-state");
if (savedState) {
  try {
    defaultState = JSON.parse(savedState);
  } catch (e) {
    console.warn(e);
  }
}

function App() {
  // MAYBE allow multiple saved games
  // MAYBE: OCR hand recognition https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s/model/41

  const [gameState, setGameState] = useState<GameState>(defaultState);
  const [mods, setMods] = useState<Mods>({
    winner: "0",
    discarder: "0",
    points: 1,
    penalty: "",
    // fakeWin: false,
  });

  const getCurrentRoundName = () => {
    // TODO Customizable option for whether rounds are repeated if dealer wins or static 16
    let i = gameState.deltas.length;
    let gameIndex = i % gameState.playerNames.length;
    let windIndex = Math.floor(i / gameState.playerNames.length) % winds.length;
    const playerName = gameState.playerNames[gameIndex];
    return `${winds[windIndex]} ${gameIndex + 1} (${playerName} deals)`;
  };

  const setAndSave = (state: GameState) => {
    setGameState(state);
    window.localStorage.setItem("mahjong-state", JSON.stringify(state));
  };

  const updatePlayerName = (newVal: string, i: number) => {
    const newNames = [...gameState.playerNames];
    newNames[i] = newVal;
    const newState = { ...gameState, playerNames: newNames };
    setAndSave(newState);
  };

  const computeScoreDeltas = (mods: Mods) => {
    // Set fan base value from reading scoreTable
    let deltas = [];
    const baseValue = scoreTable[mods.points];
    for (let [i, playerName] of gameState.playerNames.entries()) {
      deltas.push(-baseValue);
    }

    // if discarder === winner (self draw), all players pay double
    if (mods.winner === mods.discarder) {
      deltas = deltas.map((d) => d * 2);
    } else {
      // double for discarding player
      deltas[Number(mods.discarder)] *= 2;
    }

    // Minimum of 1 (even if 0 fan)
    deltas = deltas.map((d) => d || -1);

    // Reset winner to 0
    deltas[Number(mods.winner)] = 0;

    // Sum the values in deltas
    const sum = deltas.reduce((a, b) => a + b, 0);

    // If penalty, discarder pays all
    if (mods.penalty) {
      deltas = deltas.map((d, i) => (Number(mods.penalty) === i ? sum : 0));
    }

    // Set winnings
    deltas[Number(mods.winner)] = -sum;

    return deltas;
  };

  const generateCsv = () => {
    const csvArr = [];
    csvArr.push(gameState.playerNames.join(","));
    for (let d of gameState.deltas) {
      csvArr.push(d.join(","));
    }
    const csvContent = csvArr.join("\n");
    return csvContent;
  };

  const currentScores = [0, 0, 0, 0]; // sum of deltas
  const dealerIndex = gameState.deltas.length % gameState.playerNames.length;
  const previewDeltas = computeScoreDeltas(mods);
  const isSelfDraw = mods.winner === mods.discarder;
  const playerOptions = [
    ...gameState.playerNames.map((name, i) => ({
      label: name,
      value: String(i),
    })),
  ];

  const getScoreClass = (val: number) => {
    if (val > 0) return "mj-score-win";
    if (val < 0) return "mj-score-loss";
    return "mj-score-zero";
  };

  const formatDelta = (val: number) => (val > 0 ? `+${val}` : String(val));

  return (
    <main className="mj-app">
      <header className="mj-header">
        <h1 className="mj-title">
          <span className="mj-title-tile" aria-hidden="true">
            中
          </span>
          Mahjong Score Tracker
        </h1>
        <div className="mj-round-badge">
          <span className="mj-round-dot" aria-hidden="true" />
          Current Round: {getCurrentRoundName()}
        </div>
      </header>

      <section className="mj-card" aria-label="Players and Scoreboard">
        <div className="mj-card-header">
          <h2 className="mj-card-title">Table &amp; Scores</h2>
          <span className="mj-card-subtitle">
            {gameState.deltas.length}{" "}
            {gameState.deltas.length === 1 ? "hand" : "hands"} played
          </span>
        </div>

        <div className="mj-players-grid">
          {gameState.playerNames.map((_, i) => {
            const isDealer = i === dealerIndex;
            return (
              <div
                key={i}
                className={`mj-seat ${isDealer ? "mj-seat-dealer" : ""}`}
              >
                <div className="mj-seat-meta">
                  <span className="mj-wind-tile" title={winds[i]}>
                    {windChars[i]}
                  </span>
                  {isDealer && <span className="mj-dealer-tag">Dealer</span>}
                </div>
                <input
                  className="mj-input"
                  type="text"
                  aria-label={`${winds[i]} player name`}
                  value={gameState.playerNames[i]}
                  onChange={(e) => updatePlayerName(e.target.value, i)}
                />
              </div>
            );
          })}
        </div>

        <div className="mj-table-wrap">
          <table className="mj-table">
            <thead>
              <tr>
                <th className="mj-col-round">#</th>
                {gameState.playerNames.map((name, i) => (
                  <th key={i}>{name}</th>
                ))}
                <th className="mj-col-action" />
              </tr>
            </thead>
            <tbody>
              {gameState.deltas.length === 0 ? (
                <tr className="mj-row-empty">
                  <td colSpan={gameState.playerNames.length + 2}>
                    No hands recorded yet. Log the first hand below.
                  </td>
                </tr>
              ) : (
                gameState.deltas.map((delta, i) => (
                  <tr key={i}>
                    <td className="mj-col-round">{i + 1}</td>
                    {delta.map((r, j) => {
                      currentScores[j] += r;
                      return (
                        <td className={getScoreClass(r)} key={j}>
                          {formatDelta(r)}
                        </td>
                      );
                    })}
                    <td className="mj-col-action">
                      {i === gameState.deltas.length - 1 && (
                        <button
                          type="button"
                          className="mj-btn mj-btn-danger-xs"
                          onClick={() => {
                            setAndSave({
                              ...gameState,
                              deltas: gameState.deltas.slice(0, -1),
                            });
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
              <tr className="mj-row-totals">
                <td className="mj-totals-label">Total</td>
                {currentScores.map((score, i) => (
                  <td className={getScoreClass(score)} key={i}>
                    {formatDelta(score)}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mj-card" aria-label="Record Hand">
        <div className="mj-card-header">
          <h2 className="mj-card-title">Record Hand</h2>
          {isSelfDraw && (
            <span className="mj-hint">Self-draw (all pay double)</span>
          )}
        </div>

        <div className="mj-form-grid">
          <div className="mj-field">
            <label className="mj-label" htmlFor="winner-select">
              Who won?
            </label>
            <select
              id="winner-select"
              className="mj-select"
              value={mods.winner}
              onChange={(e) => {
                setMods({ ...mods, winner: e.target.value });
              }}
            >
              {playerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mj-field">
            <label className="mj-label" htmlFor="discarder-select">
              Who discarded? (if self-draw, winner)
            </label>
            <select
              id="discarder-select"
              className="mj-select"
              value={mods.discarder}
              onChange={(e) => {
                setMods({ ...mods, discarder: e.target.value });
              }}
            >
              {playerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mj-field mj-field-full">
            <label className="mj-label" htmlFor="penalty-select">
              Player paying all losses (9 or 12 piece penalty)
            </label>
            <select
              id="penalty-select"
              className="mj-select"
              value={mods.penalty}
              onChange={(e) => {
                setMods({ ...mods, penalty: e.target.value });
              }}
            >
              {[{ label: "None", value: "" }, ...playerOptions].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* <Checkbox
            checked={mods.fakeWin}
            label={`Fake win ("winner" pays other players)`}
            onChange={(e) => {
              setMods({ ...mods, fakeWin: e.target.checked });
            }}
          /> */}

          <div className="mj-field mj-field-full">
            <div className="mj-slider-header">
              <label className="mj-label" htmlFor="points-slider">
                How many points (fan)?
              </label>
              <span className="mj-fan-badge">{mods.points} fan</span>
            </div>
            <div className="mj-slider-wrap">
              <button
                type="button"
                className="mj-step-btn"
                aria-label="Decrease fan"
                disabled={mods.points <= 0}
                onClick={() =>
                  setMods({ ...mods, points: Math.max(0, mods.points - 1) })
                }
              >
                −
              </button>
              <input
                id="points-slider"
                type="range"
                className="mj-slider"
                min={0}
                max={13}
                value={mods.points}
                onChange={(e) => {
                  setMods({ ...mods, points: Number(e.target.value) });
                }}
              />
              <button
                type="button"
                className="mj-step-btn"
                aria-label="Increase fan"
                disabled={mods.points >= 13}
                onClick={() =>
                  setMods({ ...mods, points: Math.min(13, mods.points + 1) })
                }
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mj-preview-grid" aria-label="Hand score preview">
          {previewDeltas.map((delta, i) => (
            <div
              key={i}
              className={`mj-preview-item ${
                delta > 0 ? "mj-preview-item-win" : ""
              }`}
            >
              <span className="mj-preview-name">
                {gameState.playerNames[i]}
              </span>
              <span className={`mj-preview-delta ${getScoreClass(delta)}`}>
                {formatDelta(delta)}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mj-btn mj-btn-full"
          onClick={() => {
            const deltas = computeScoreDeltas(mods);
            setAndSave({
              ...gameState,
              deltas: [...gameState.deltas, deltas],
            });
          }}
        >
          Add Game
        </button>
      </section>

      <footer className="mj-footer">
        {/* <Button onClick={() => setGameState({ ...gameState, deltas: [] })}>
          Reset
        </Button> */}
        <a
          className="mj-btn mj-btn-secondary"
          href={"data:text/csv;charset=utf-8," + generateCsv()}
          download={"mahjongScores.csv"}
        >
          Export CSV
        </a>
        <a
          className="mj-ref-link"
          target="_blank"
          rel="noreferrer"
          href="https://en.wikipedia.org/wiki/Hong_Kong_mahjong_scoring_rules"
        >
          Scoring Reference ↗
        </a>
      </footer>
    </main>
  );
}

export default App;
