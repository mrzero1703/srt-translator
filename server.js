require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const upload = multer({ dest: "/tmp/" });
const HISTORY_FILE = "/tmp/history.json";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static("public"));

// Dịch từng đoạn
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
    return text;
  }
}

// Lưu lịch sử
function saveHistory(item) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  history.unshift(item);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Parse / Build SRT
function parseSRT(content) {
  return content.split("\n\n").map(block => {
    const lines = block.split("\n");
    if (lines.length >= 3) return { index: lines[0], time: lines[1], text: lines.slice(2).join(" ") };
    return null;
  }).filter(Boolean);
}

function buildSRT(blocks) {
  return blocks.map(b => `${b.index}\n${b.time}\n${b.text}\n`).join("\n");
}

// Translate chunk
async function translateChunk(blocks) {
  const translated = [];
  for (const block of blocks) {
    if (block.text.trim() !== "") block.text = await translateWithGemini(block.text);
    translated.push(block);
  }
  return translated;
}

// Route dịch SRT
app.post("/translate", upload.single("file"), async (req, res) => {
  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    const subs = parseSRT(content);

    const translated = await translateChunk(subs);
    const output = buildSRT(translated);

    const historyItem = {
      id: Date.now(),
      fileName: req.file.originalname,
      time: new Date().toLocaleString("vi-VN"),
      content: output
    };
    saveHistory(historyItem);

    res.setHeader('Content-Disposition', 'attachment; filename="translated.srt"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(output);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi dịch Gemini" });
  }
});

// Lấy lịch sử
app.get("/history", (req, res) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  res.json(history);
});

// Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
