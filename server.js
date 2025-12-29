require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { translate } = require("@vitalets/google-translate-api");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Translate } = require("@google-cloud/translate").v2;
const app = express();
const upload = multer({ dest: "uploads/" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
});
const translate = new Translate({
  key: process.env.GG_TRANSLATE_KEY
});
app.use(express.static("public"));
const HISTORY_FILE = "history.json";

function saveHistory(item) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  history.unshift(item);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/* ===== UTILS ===== */

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
  return blocks.map(b =>
    `${b.index}\n${b.time}\n${b.text}\n`
  ).join("\n");
}

function splitArray(arr, size = 5) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

async function translateWithGemini(lines) {
  const prompt = `
Translate Chinese subtitles to Vietnamese.
Rules:
- Keep same number of lines
- Subtitle style
- No explanations

${lines.join("\n")}
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
      signal: controller.signal,
    });

    const text = result.response.text();
    return text.trim().split("\n");

  } catch (err) {
    console.warn("⚠ Gemini lỗi → fallback GG Translate");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateWithGoogle(lines) {
  const results = [];

  for (const line of lines) {
    if (!line.trim()) {
      results.push(line);
      continue;
    }

    const res = await translate(line, {
      from: "zh-cn",
      to: "vi"
    });

    results.push(res.text);
  }

  return results;
}
async function translateSafe(lines) {
  try {
    // ⏱ timeout chống Gemini treo
    const geminiResult = await Promise.race([
      translateWithGemini(lines),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 20000)
      )
    ]);

    return geminiResult;

  } catch (err) {
    console.warn("⚠ Gemini lỗi → dùng Google Translate");

    return await translateWithGoogle(lines);
  }
}


/* ===== ROUTE ===== */

app.post("/translate", upload.single("file"), async (req, res) => {
if (!req.file) {
  return res.status(400).json({
    error: "Chưa chọn file SRT"
  });
}

  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    fs.unlink(req.file.path, () => { });

    const subs = parseSRT(content);
    const chunks = splitArray(subs, 5);

    let translated = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`🔄 Translating ${i + 1}/${chunks.length}`);

      const chunk = chunks[i];
      const texts = chunk.map(b => b.text || " ");

      // const results = await translateSmart(texts);
      const results = await translateSafe(texts);



      chunk.forEach((b, idx) => {
        b.text = results[idx] || b.text;
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

    // res.setHeader("Content-Type", "text/plain; charset=utf-8");
    // res.setHeader("Content-Disposition", "attachment; filename=translated.srt");
    res.send(output);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi dịch Gemini / Google Translate" });

  }
});
//lịch sử
app.get("/history", (req, res) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  res.json({
    text: output,
  file: "translated.srt"
  });
});



app.listen(3000, () =>
  console.log("🚀 Server chạy tại http://localhost:3000")
);


// Quan trọng cho Render: Lắng nghe trên cổng do môi trường cung cấp
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
