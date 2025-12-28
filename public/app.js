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
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(form);

      const res = await fetch("/translate", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      output.textContent = data.text;
      downloadBtn.href = URL.createObjectURL(
        new Blob([data.text], { type: "text/plain" })
      );
      downloadBtn.download = data.file;

      resultBox.classList.remove("hidden");
    });

    // Dark mode
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
    const historyList = document.getElementById("historyList");

    async function loadHistory() {
      const res = await fetch("/history");
      const history = await res.json();

      historyList.innerHTML = "";
      history.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
      <strong>${item.fileName}</strong>
      <br>
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
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      fileText.textContent = "📄 " + file.name;
      fileInfo.innerHTML = `
    <strong>${file.name}</strong><br>
    ${(file.size / 1024).toFixed(1)} KB
  `;
      fileInfo.classList.remove("hidden");
    });

    /* SUBMIT + GIẢ LẬP PROGRESS */
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      progressBox.classList.remove("hidden");
      progressBar.style.width = "0%";
      progressText.textContent = "0%";

      // Giả lập tiến trình (frontend)
      let percent = 0;
      const fakeProgress = setInterval(() => {
        percent += 5;
        if (percent >= 90) {
          clearInterval(fakeProgress);
        }
        progressBar.style.width = percent + "%";
        progressText.textContent = percent + "%";
      }, 300);

      const formData = new FormData(uploadForm);
      const res = await fetch("/translate", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      clearInterval(fakeProgress);
      progressBar.style.width = "100%";
      progressText.textContent = "100%";

      output.textContent = data.text;
      resultBox.classList.remove("hidden");
    });
    /* CHẶN MỞ FILE RA TAB MỚI */
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
      document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    const uploadBox = document.querySelector(".upload-box");
    uploadBox.addEventListener("drop", (e) => {
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
    reader.onload = () => {
  const lines = reader.result.split("\n");

  lines.forEach(line => {
    if (!line.trim()) return;
    const data = JSON.parse(line);

    if (data.progress) {
      progressBar.style.width = data.progress + "%";
    }

    if (data.done) {
      showTranslatedResult(data.result);
      progressBar.style.width = "100%";
      enableUI();
    }
  });
};