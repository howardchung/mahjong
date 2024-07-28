import { useState } from 'react'
import './App.css'

function App() {
  const scoreTable = [0, 1, 2, 4, 8, 12, 24, 32, 48, 64, 96, 128, 192, 256];
  // double for discard
  // +1 fan all double for self draw
  // 9 or 12 piece penalty
  // Enter user names (4)
  // Show running total
  // UI to indicate winner
  // Manual fan entry
  // Export scores to CSV
  // OCR hand recognition
  // Save state to localstorage
  const [playerNames, setPlayerNames] = useState([]);
  const [results, setResults] = useState([]);
  
  return (
    <div>
      <input type="text"></input>
      <table>
        <th>
        {playerNames.map(name => <td>{name}</td>)}
        </th>
        <tr>
          {results.map(result => <td>{JSON.stringify(result)}</td>)}
        </tr>
      </table>
    </div>
       );
}

export default App
