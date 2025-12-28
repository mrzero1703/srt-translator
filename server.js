const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { translate } = require("@vitalets/google-translate-api"); // ← SỬA Ở ĐÂY

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));
const HISTORY_FILE = "history.json";

function saveHistory(item) {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  history.unshift(item);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

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
app.post("/translate", upload.single("srt"), async (req, res) => {
  const input = fs.readFileSync(req.file.path, "utf8");
  const blocks = parseSRT(input);

  for (let block of blocks) {
    if (block.text.trim() !== "") {
      const result = await translate(block.text, {
        from: "zh-cn",
        to: "vi"
      });
      block.text = result.text;
    }
  }

  const output = buildSRT(blocks);
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

res.json({
  text: output,
  file: fileName,
  history: historyItem
});

});
app.get("/history", (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  res.json(history);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
