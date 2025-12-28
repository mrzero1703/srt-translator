require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// Sử dụng thư mục /tmp của Render để lưu file tạm
const upload = multer({ dest: "/tmp/" });
const HISTORY_FILE = "/tmp/history.json";

// Khởi tạo Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static("public"));
app.use(express.json());

// Hàm dịch sử dụng API Gemini mới nhất
async function translateWithGemini(text) {
  try {
    // Lưu ý: Cấu trúc gọi hàm generateContent của Gemini SDK
    const result = await model.generateContent(`Dịch đoạn sau từ tiếng Trung sang tiếng Việt, chỉ trả về bản dịch, không thêm chú thích: "${text}"`);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Lỗi dịch Gemini:", err.message);
    return text; // Trả về text gốc nếu lỗi
  }
}

// Lưu lịch sử vào file tạm (Lưu ý: Render sẽ xóa /tmp khi restart app)
function saveHistory(item) {
  let history = [];
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    }
    history.unshift(item);
    // Giới hạn 10 mục gần nhất để tránh đầy bộ nhớ
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 10), null, 2));
  } catch (e) {
    console.error("Không thể lưu lịch sử:", e);
  }
}

// Parse SRT logic
function parseSRT(content) {
  // Chuẩn hóa xuống dòng để tránh lỗi Windows/Unix
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized.split("\n\n").map(block => {
    const lines = block.split("\n");
    if (lines.length >= 3) {
      return { 
        index: lines[0], 
        time: lines[1], 
        text: lines.slice(2).join("\n") 
      };
    }
    return null;
  }).filter(Boolean);
}

function buildSRT(blocks) {
  return blocks.map(b => `${b.index}\n${b.time}\n${b.text}`).join("\n\n");
}

// Route dịch chính
app.post("/translate", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("Không có file nào được tải lên.");

  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    const subs = parseSRT(content);

    // Dịch tuần tự (hoặc dùng Promise.all nếu muốn nhanh nhưng dễ dính rate limit)
    const translated = [];
    for (const block of subs) {
      if (block.text.trim() !== "") {
        block.text = await translateWithGemini(block.text);
      }
      translated.push(block);
    }

    const output = buildSRT(translated);

    const historyItem = {
      id: Date.now(),
      fileName: req.file.originalname,
      time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      content: output
    };
    saveHistory(historyItem);

    // Xóa file tạm sau khi xử lý xong
    fs.unlinkSync(req.file.path);

    res.setHeader('Content-Disposition', `attachment; filename="translated_${req.file.originalname}"`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(output);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi hệ thống khi dịch" });
  }
});

app.get("/history", (req, res) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
  res.json(history);
});

// Quan trọng cho Render: Lắng nghe trên cổng do môi trường cung cấp
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});