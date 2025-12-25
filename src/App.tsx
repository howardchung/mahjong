import React, { useCallback, useState } from "react";
import "./App.css";
import {
  Button,
  Checkbox,
  Input,
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

function App() {
  // Enter user names (4)
  // Show running total
  // UI to indicate winner, wind, repeat games
  // Export scores to CSV
  // Save state to localstorage
  // allow multiple saved games
  // BONUS: OCR hand recognition
  // https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s/model/41

  // Customizable option for whether rounds are repeated or static 16
  // Allow deleting games and fixing scores (can only delete last game? since can't reinsert game into middle of results)
  const [playerNames, setPlayerNames] = useState([
    "East",
    "South",
    "West",
    "North",
  ]);
  const [results, setResults] = useState<Array<{ deltas: number[] }>>([]);
  const [gameState, setGameState] = useState({
    repeatGames: false, // Option: repeat the game if dealer won or tie
  });

  const getCurrentRoundName = () => {
    let i = 0;
    let windIndex = 0;
    const playerName = playerNames[i];
    return `${winds[windIndex]} ${i + 1} (${playerName} deals)`;
  };

  const updatePlayerName = useCallback((newVal: string, i: number) => {
    const newNames = [...playerNames];
    newNames[i] = newVal;
    setPlayerNames(newNames);
  }, []);

  const [mods, setMods] = useState<{
    winner: string | undefined;
    discarder: string | undefined;
    penalty: boolean;
    fan: number;
    fakeWin: boolean;
  }>({
    winner: "0",
    discarder: "0",
    fan: 1,
    penalty: false,
    fakeWin: false,
  });

  const computeScoreDeltas = () => {
    // Set fan base value from reading scoreTable
    let deltas = [];
    const baseValue = scoreTable[mods.fan];
    for (let [i, playerName] of playerNames.entries()) {
      deltas.push(Number(mods.winner) === i ? 0 : -baseValue);
    }
    // double for discarding player
    deltas[Number(mods.discarder)] *= 2;

    // if discarder === winner (self draw), all players pay double
    if (mods.winner === mods.discarder) {
      deltas = deltas.map((d) => d * 2);
    }

    // if penalty, discarder pays all losses
    // if tie, no changes
    // Apply minimum of 1 if 0 fan
    // Sum the values in deltas and put the winner's winnings
    const sum = deltas.reduce((a, b) => a + b, 0);
    deltas[Number(mods.winner)] = -sum;
    // compute who the dealer is based on previous game results
    // Repeat game if tie or dealer won last game or fakewin (can be turned on and off)
    // 🎲
    return deltas;
  };

  const currentScores = [0, 0, 0, 0]; // sum of deltas
  // Need to name each row based on whether it was a tie/repeat win
  const playerOptions = [
    ...playerNames.map((name, i) => ({ label: name, value: String(i) })),
  ];
  return (
    <MantineProvider defaultColorScheme="dark">
      <div>Current Round: {getCurrentRoundName()}</div>
      <div>
        <div style={{ display: "flex" }}>
          {playerNames.map((_, i) => {
            return (
              <TextInput
                key={i}
                type="text"
                value={playerNames[i]}
                onChange={(e) => updatePlayerName(e.target.value, i)}
              />
            );
          })}
        </div>
        <Table>
          <Table.Thead>
            <Table.Tr>
              {playerNames.map((name, i) => (
                <Table.Td key={i}>{name}</Table.Td>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.map((result, i) => (
              <Table.Tr key={i}>
                {result.deltas.map((r, j) => {
                  currentScores[j] += r;
                  return <Table.Td key={j}>{r}</Table.Td>;
                })}
                {i === results.length - 1 && <Table.Td>Delete</Table.Td>}
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
            label="Who won? (leave blank for draw)"
            data={playerOptions}
            rightSection={<div>Clear</div>}
            value={mods.winner}
            onChange={(e) => {
              setMods({ ...mods, winner: e.target.value });
            }}
          />
          <NativeSelect
            label="Who discarded winning tile? (choose winner for self-draw)"
            data={playerOptions}
            rightSection={<div>Clear</div>}
            value={mods.discarder}
            onChange={(e) => {
              setMods({ ...mods, discarder: e.target.value });
            }}
          />
          <Checkbox
            checked={mods.penalty}
            label="Discarder pays all losses (for 9 piece pure hand discard or 12 piece pure hand self-draw)"
            onChange={(e) => {
              setMods({ ...mods, penalty: e.target.checked });
            }}
          />
          <Checkbox
            checked={mods.fakeWin}
            label={`Fake win ("winner" pays other players)`}
            onChange={(e) => {
              setMods({ ...mods, fakeWin: e.target.checked });
            }}
          />
          <Text>How many fan?</Text>
          <Slider
            value={mods.fan}
            max={13}
            labelAlwaysOn
            onChange={(val) => {
              setMods({ ...mods, fan: val });
            }}
          />
          {/* calculate repeatGame if dealer won or no one won */}
          <Table>
            <Table.Tbody>
              <Table.Tr>
                {computeScoreDeltas().map((delta, i) => (
                  <Table.Td key={i}>{delta}</Table.Td>
                ))}
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Button
            onClick={() => {
              const deltas = computeScoreDeltas();
              const newResults = [...results, { deltas }];
              setResults(newResults);
            }}
          >
            Save
          </Button>
        </div>
        <Button>Reset</Button>
        <Button>Export</Button>
      </div>
    </MantineProvider>
  );
}

export default App;
