import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import "./style.css";
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

import "./style.css";

export default function App() {
  return (
    <div className="container">
      <div className="card">
        <h1>Dịch phụ đề SRT</h1>
        <p className="subtitle">Trung → Việt</p>

        <form
          action="http://localhost:3000/translate"
          method="post"
          encType="multipart/form-data"
        >
          <label className="upload-box">
            <input type="file" name="srt" accept=".srt" required />
            <span>📂 Kéo thả hoặc chọn file .srt</span>
          </label>

          <button type="submit">🚀 DỊCH & TẢI FILE</button>
        </form>
      </div>
    </div>
  );
}

