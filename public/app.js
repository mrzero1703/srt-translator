const form = document.getElementById("uploadForm");
const output = document.getElementById("output");
const resultBox = document.getElementById("result");
const downloadBtn = document.getElementById("download");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileText = document.getElementById("fileText");
const progressBox = document.getElementById("progressBox");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const historyList = document.getElementById("historyList");

/* ================= FILE INFO ================= */
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  fileText.textContent = "📄 " + file.name;
  fileInfo.innerHTML = `
    <strong>${file.name}</strong><br>
    ${(file.size / 1024).toFixed(1)} KB
  `;
  fileInfo.classList.remove("hidden");
});

/* ================= SUBMIT + PROGRESS ================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!fileInput.files.length) {
    alert("⚠️ Vui lòng chọn file .srt");
    return;
  }
  progressBox.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  let percent = 0;
  const fakeProgress = setInterval(() => {
    percent += 5;
    if (percent >= 90) {
      clearInterval(fakeProgress);
    }
    progressBar.style.width = percent + "%";
    progressText.textContent = percent + "%";
  }, 300);

  try {
    const formData = new FormData(form);

    const res = await fetch("/translate", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const text = await res.text(); // ⚠️ KHÔNG DÙNG res.json()

    clearInterval(fakeProgress);
    progressBar.style.width = "100%";
    progressText.textContent = "100%";

    output.textContent = text;

    downloadBtn.href = URL.createObjectURL(
      new Blob([text], { type: "text/plain" })
    );
    downloadBtn.download = "translated.srt";

    resultBox.classList.remove("hidden");
  } catch (err) {
    clearInterval(fakeProgress);
    progressText.textContent = "Lỗi ❌";
    alert("Lỗi dịch: " + err.message);
  }
});

/* ================= HISTORY ================= */
async function loadHistory() {
  const res = await fetch("/history");
  const history = await res.json();

  historyList.innerHTML = "";
  history.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${item.fileName}</strong><br>
      <small>${item.time}</small>
    `;
    li.onclick = () => {
      output.textContent = item.content;
      resultBox.classList.remove("hidden");
    };
    historyList.appendChild(li);
  });
}

loadHistory();

/* ================= DARK MODE ================= */
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
}

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}

/* ================= DRAG & DROP ================= */
["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
  document.addEventListener(eventName, e => {
    e.preventDefault();
    e.stopPropagation();
  });
});

const uploadBox = document.querySelector(".upload-box");

uploadBox.addEventListener("drop", e => {
  const files = e.dataTransfer.files;
  if (files.length) {
    fileInput.files = files;
    fileInput.dispatchEvent(new Event("change"));
  }
});

uploadBox.addEventListener("dragover", () => {
  uploadBox.classList.add("dragging");
});

uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("dragging");
});
