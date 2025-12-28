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
async function translateWithGemini(lines) {
  const prompt = `
Translate Chinese subtitles to Vietnamese.

Rules:
- Each input line translates to exactly ONE output line
- Keep order
- Short subtitle style
- NO explanations

INPUT:
${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

OUTPUT:
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  return text
    .split("\n")
    .map(line => line.replace(/^\d+\.\s*/, ""));
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
function splitArray(arr, size = 10) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}



// Route dịch SRT
app.post("/translate", upload.single("file"), async (req, res) => {
  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    const subs = parseSRT(content);
    const chunks = splitArray(subs, 8); // 🔥 nhỏ lại cho an toàn

    let translated = [];

    for (const chunk of chunks) {
      const texts = chunk.map(b => b.text || " ");
      const results = await translateWithGemini(texts);

      chunk.forEach((b, i) => {
        b.text = results[i] ?? b.text;
        translated.push(b);
      });
    }

    const output = buildSRT(translated);

    saveHistory({
      id: Date.now(),
      fileName: req.file.originalname,
      time: new Date().toLocaleString("vi-VN"),
      content: output
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=translated.srt");
    res.send(output);

  } catch (err) {
    console.error("❌ Gemini error:", err);
    res.status(500).json({ error: "Gemini dịch bị lỗi" });
  }
});


// Lấy lịch sử
app.get("/history", (req, res) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  res.json(history);
});

// Port
// Quan trọng cho Render: Lắng nghe trên cổng do môi trường cung cấp
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

app.listen(3000, () => console.log("🚀 Server chạy tại http://localhost:3000") );