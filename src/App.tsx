import React, { useCallback, useState } from "react";
import "./App.css";
import {
  Button,
  MantineProvider,
  NativeSelect,
  Slider,
  Table,
  TextInput,
  Text,
} from "@mantine/core";
import "@mantine/core/styles.css";

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
    <MantineProvider defaultColorScheme="dark">
      <h2>Mahjong Score Tracker</h2>
      <div>Current Round: {getCurrentRoundName()}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex" }}>
          {gameState.playerNames.map((_, i) => {
            return (
              <TextInput
                key={i}
                type="text"
                value={gameState.playerNames[i]}
                onChange={(e) => updatePlayerName(e.target.value, i)}
              />
            );
          })}
        </div>
        <Table>
          <Table.Thead>
            <Table.Tr>
              {gameState.playerNames.map((name, i) => (
                <Table.Td key={i}>{name}</Table.Td>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {gameState.deltas.map((delta, i) => (
              <Table.Tr key={i}>
                {delta.map((r, j) => {
                  currentScores[j] += r;
                  return (
                    <Table.Td
                      style={{ backgroundColor: r > 0 ? "green" : undefined }}
                      key={j}
                    >
                      {r}
                    </Table.Td>
                  );
                })}
                {i === gameState.deltas.length - 1 && (
                  <Table.Td>
                    <Button
                      color="red"
                      size="xs"
                      onClick={() => {
                        setAndSave({
                          ...gameState,
                          deltas: gameState.deltas.slice(0, -1),
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            <Table.Tr style={{ fontWeight: 700 }}>
              {currentScores.map((score, i) => (
                <Table.Td key={i}>{score}</Table.Td>
              ))}
              <Table.Td>Totals</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <NativeSelect
            label="Who won?"
            data={playerOptions}
            // rightSection={<div>Clear</div>}
            value={mods.winner}
            onChange={(e) => {
              setMods({ ...mods, winner: e.target.value });
            }}
          />
          <NativeSelect
            label="Who discarded winning tile? (if self-draw, winner)"
            data={playerOptions}
            // rightSection={<div>Clear</div>}
            value={mods.discarder}
            onChange={(e) => {
              setMods({ ...mods, discarder: e.target.value });
            }}
          />
          <NativeSelect
            label="Player paying all losses (9 or 12 piece penalty)"
            data={[{ label: "None", value: "" }, ...playerOptions]}
            // rightSection={<div>Clear</div>}
            value={mods.penalty}
            onChange={(e) => {
              setMods({ ...mods, penalty: e.target.value });
            }}
          />
          {/* <Checkbox
            checked={mods.fakeWin}
            label={`Fake win ("winner" pays other players)`}
            onChange={(e) => {
              setMods({ ...mods, fakeWin: e.target.checked });
            }}
          /> */}
          <Text>How many points (fan)?</Text>
          <Slider
            value={mods.points}
            max={13}
            labelAlwaysOn
            onChange={(val) => {
              setMods({ ...mods, points: val });
            }}
          />
          <Table>
            <Table.Tbody>
              <Table.Tr>
                {computeScoreDeltas(mods).map((delta, i) => (
                  <Table.Td key={i}>{delta}</Table.Td>
                ))}
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Button
            onClick={() => {
              const deltas = computeScoreDeltas(mods);
              setAndSave({
                ...gameState,
                deltas: [...gameState.deltas, deltas],
              });
            }}
          >
            Add Game
          </Button>
        </div>
        {/* <Button onClick={() => setGameState({ ...gameState, deltas: [] })}>
          Reset
        </Button> */}
        <Button
          component="a"
          href={"data:text/csv;charset=utf-8," + generateCsv()}
          download={"mahjongScores.csv"}
        >
          Export
        </Button>
        <a
          target="_blank"
          href="https://en.wikipedia.org/wiki/Hong_Kong_mahjong_scoring_rules"
        >
          Scoring Reference
        </a>
      </div>
    </MantineProvider>
  );
}

export default App;
