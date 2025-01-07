import React, { useState } from 'react'
import './App.css'
import { Button, Checkbox, Input, MantineProvider, NativeSelect, NumberInput, Radio, Slider, Table, TextInput } from '@mantine/core';
import "@mantine/core/styles.css";

const scoreTable = [0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192];
const winds = ['East', 'South', 'West', 'North'];

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
  const [playerNames, setPlayerNames] = useState(['East', 'South', 'West', 'North']);
  const [gameState, setGameState] = useState({
    repeatGames: true, // repeat if dealer won or tie
  });
  const [results, setResults] = useState<Array<{deltas: number[]}>>([]);

  const computeScoreDeltas = (mods: any) => {
    // double for discard
    // Manual fan entry, discarder/self draw, 9/12 penalty, tiegame
    const deltas = [0,0,0,0];
    // compute who the dealer is based on game results
    // Repeat game if tie or dealer won last game or fakewin
    // 🎲
    results.push({deltas: deltas});
  };

  const computeCurrentRound = () => {
    let i = 0;
    let windIndex = 0;
    const playerName = playerNames[i];
    return `${winds[windIndex]} ${i} (${playerName})`;
  }

  const currentScores = []; // sum of deltas
  // Need to name each row based on whether it was a tie/repeat win
  return (
    <MantineProvider defaultColorScheme='dark'>
      <div>{computeCurrentRound()}</div>
    <div>
      <input type="text" value={playerNames[0]}></input>
      <input type="text" value={playerNames[1]}></input>
      <input type="text" value={playerNames[2]}></input>
      <input type="text" value={playerNames[3]}></input>
      <Table>
        <Table.Thead>
          <Table.Tr>
            {playerNames.map(name => <Table.Td>{name}</Table.Td>)}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
            {results.map(result => <Table.Tr>
              <Table.Td>Calculate display name</Table.Td>
              <Table.Td>{JSON.stringify(result)}</Table.Td>
            </Table.Tr>)}
        </Table.Tbody>
      </Table>
      <div>
        <NativeSelect data={playerNames} /> Who won? (player or no one (tie))
        <NativeSelect data={playerNames} />Who discarded? (player or self draw)
        <NativeSelect data={playerNames} />Player pays all losses (for 9 piece pure hand discard or 12 piece pure hand self-draw)
        <Slider value={0} label="How many fan?" />
        <Checkbox />Was it a fake win? ("winner" pays other players)
        <Checkbox /> Repeat game (no one one or dealer won)
        <div>Show proposed deltas</div>
        <Button>Submit</Button>
        {/*
          const modifiers = {
    isSelfDraw: false, // everyone pays double (also +1 fan)
    isNineTwelvePenalty: false, // discarder pays all losses
    discarder: null,
    winner: null,
    fan: 0,
    isTie: false,
    isFakeWin: false,
  };
*/}
      </div>
      <Button>Add Game</Button>
      <Button>New Session</Button>
      <Button>Export</Button>
    </div>
    </MantineProvider>
       );
}

export default App
