// Gemini
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const app = express();
const multer = require("multer");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
});

const upload = multer({ dest: "uploads/" });
const HISTORY_FILE = "history.json";

app.use(express.static("public"));

// Hàm dịch từng đoạn bằng Gemini
async function translateWithGemini(text) {
  try {
    const response = await model.generate({
      prompt: `Dịch đoạn sau từ tiếng Trung sang tiếng Việt: "${text}"`,
      temperature: 0.3,
      maxOutputTokens: 500
    });
    return response.candidates[0].content;
  } catch (err) {
    console.error("Lỗi dịch Gemini:", err);
    return text; // trả về nguyên văn nếu dịch lỗi
  }
}

// Hàm lưu lịch sử
function saveHistory(item) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  history.unshift(item);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Parse và build SRT
function parseSRT(content) {
  return content.split("\n\n").map(block => {
    const lines = block.split("\n");
    if (lines.length >= 3) {
      return {
        index: lines[0],
        time: lines[1],
        text: lines.slice(2).join(" ")
      };
    }
    return null;
  }).filter(Boolean);
}

function buildSRT(blocks) {
  return blocks.map(b => `${b.index}\n${b.time}\n${b.text}\n`).join("\n");
}

// Chia nhỏ subtitles thành chunk
function splitSRT(subtitles, chunkSize = 15) {
  const chunks = [];
  for (let i = 0; i < subtitles.length; i += chunkSize) {
    chunks.push(subtitles.slice(i, i + chunkSize));
  }
  return chunks;
}

// Hàm dịch chunk
async function translateChunk(blocks) {
  const translated = [];
  for (const block of blocks) {
    if (block.text.trim() !== "") {
      block.text = await translateWithGemini(block.text);
    }
    translated.push(block);
  }
  return translated;
}

// Route dịch SRT
app.post("/translate", upload.single("file"), async (req, res) => {
  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    const subs = parseSRT(content);
    const chunks = splitSRT(subs, 15);

    let translated = [];
    let done = 0;

    res.setHeader("Content-Type", "application/json");

    for (const chunk of chunks) {
      const result = await translateChunk(chunk);
      translated.push(...result);
      done++;

      // gửi progress
      res.write(JSON.stringify({
        progress: Math.round(done / chunks.length * 100)
      }) + "\n");
    }

    const output = buildSRT(translated);
    const fileName = "translated.srt";
    const outputPath = `uploads/${fileName}`;
    fs.writeFileSync(outputPath, output, "utf8");

    const historyItem = {
      id: Date.now(),
      fileName: req.file.originalname,
      time: new Date().toLocaleString("vi-VN"),
      content: output
    };
    saveHistory(historyItem);

    // gửi kết quả cuối
    res.write(JSON.stringify({
      done: true,
      result: output,
      file: fileName,
      history: historyItem
    }));
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi dịch Gemini" });
  }
});

// Lấy lịch sử
app.get("/history", (req, res) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  res.json(history);
});

// Port
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
