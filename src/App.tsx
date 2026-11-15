import React, { useState } from "react";
import "./App.css";

const scoreTable = [0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const winds = ["East", "South", "West", "North"];
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
  const playerOptions = [
    ...gameState.playerNames.map((name, i) => ({
      label: name,
      value: String(i),
    })),
  ];
  return (
    <>
      <h2 className="mj-title">Mahjong Score Tracker</h2>
      <div className="mj-round">Current Round: {getCurrentRoundName()}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {gameState.playerNames.map((_, i) => {
            return (
              <input
                key={i}
                className="ui-input"
                type="text"
                value={gameState.playerNames[i]}
                onChange={(e) => updatePlayerName(e.target.value, i)}
              />
            );
          })}
        </div>
        <table className="ui-table">
          <thead>
            <tr>
              {gameState.playerNames.map((name, i) => (
                <td key={i}>{name}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {gameState.deltas.map((delta, i) => (
              <tr key={i}>
                {delta.map((r, j) => {
                  currentScores[j] += r;
                  return (
                    <td
                      style={{ backgroundColor: r > 0 ? "green" : undefined }}
                      key={j}
                    >
                      {r}
                    </td>
                  );
                })}
                {i === gameState.deltas.length - 1 && (
                  <td>
                    <button
                      type="button"
                      className="ui-btn ui-btn-red ui-btn-xs"
                      onClick={() => {
                        setAndSave({
                          ...gameState,
                          deltas: gameState.deltas.slice(0, -1),
                        });
                      }}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              {currentScores.map((score, i) => (
                <td key={i}>{score}</td>
              ))}
              <td>Totals</td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="ui-field">
            <label className="ui-label" htmlFor="winner-select">
              Who won?
            </label>
            <select
              id="winner-select"
              className="ui-select"
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
          <div className="ui-field">
            <label className="ui-label" htmlFor="discarder-select">
              Who discarded winning tile? (if self-draw, winner)
            </label>
            <select
              id="discarder-select"
              className="ui-select"
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
          <div className="ui-field">
            <label className="ui-label" htmlFor="penalty-select">
              Player paying all losses (9 or 12 piece penalty)
            </label>
            <select
              id="penalty-select"
              className="ui-select"
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
          <span className="ui-label">How many points (fan)?</span>
          <div className="ui-slider-wrap">
            <input
              type="range"
              className="ui-slider"
              min={0}
              max={13}
              value={mods.points}
              onChange={(e) => {
                setMods({ ...mods, points: Number(e.target.value) });
              }}
            />
            <span className="ui-slider-value">{mods.points}</span>
          </div>
          <table className="ui-table">
            <tbody>
              <tr>
                {computeScoreDeltas(mods).map((delta, i) => (
                  <td key={i}>{delta}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <button
            type="button"
            className="ui-btn"
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
        </div>
        {/* <Button onClick={() => setGameState({ ...gameState, deltas: [] })}>
          Reset
        </Button> */}
        <a
          className="ui-btn"
          href={"data:text/csv;charset=utf-8," + generateCsv()}
          download={"mahjongScores.csv"}
        >
          Export
        </a>
        <a
          target="_blank"
          href="https://en.wikipedia.org/wiki/Hong_Kong_mahjong_scoring_rules"
        >
          Scoring Reference
        </a>
      </div>
    </>
  );
}

export default App;
