(() => {
  const form = document.getElementById("ninconvert-form");
  if (!form) {
    return;
  }

  const fileInput = document.getElementById("nin-file");
  const dropzone = document.getElementById("nin-dropzone");
  const formatInput = document.getElementById("nin-format");
  const loopEnabledInput = document.getElementById("nin-loop-enabled");
  const loopStartInput = document.getElementById("nin-loop-start");
  const loopEndInput = document.getElementById("nin-loop-end");
  const sourceAudio = document.getElementById("nin-source-audio");
  const sourcePlayBtn = document.getElementById("nin-source-play-btn");
  const sourceSeek = document.getElementById("nin-source-seek");
  const sourceTime = document.getElementById("nin-source-time");
  const previewMeta = document.getElementById("nin-preview-meta");
  const setLoopStartBtn = document.getElementById("nin-set-loop-start");
  const setLoopEndBtn = document.getElementById("nin-set-loop-end");
  const loopPreviewBtn = document.getElementById("nin-loop-preview-btn");
  const apiUrlInput = document.getElementById("nin-api-url");
  const convertBtn = document.getElementById("nin-convert-btn");
  const statusNode = document.getElementById("nin-status");
  const downloadLink = document.getElementById("nin-download");

  const storageKey = "ninconvert-api-url";
  const translations = window.SITE_TRANSLATIONS || {};
  let sourceObjectUrl = "";
  let sourceSampleRate = 48000;
  let loopPreviewEnabled = false;
  let audioContext = null;
  const allowedInputExtensions = new Set([
    "wav",
    "mp3",
    "ogg"
  ]);

  function getCurrentTranslation() {
    const rawChoice = localStorage.getItem("site-lang") || "system";
    const choice = rawChoice === "system"
      ? ((navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr")
      : rawChoice;
    return translations[choice] || translations.fr || {};
  }

  function tr(key, fallback) {
    const t = getCurrentTranslation();
    const value = t && typeof t[key] === "string" ? t[key] : "";
    return value || fallback;
  }

  function isLoopbackHost(host) {
    return host === "localhost" || host === "127.0.0.1";
  }

  function isLoopbackUrl(urlValue) {
    try {
      const parsed = new URL(urlValue);
      return isLoopbackHost(parsed.hostname);
    } catch (_) {
      return false;
    }
  }

  const host = window.location.hostname || "";
  const isCurrentHostLocal = isLoopbackHost(host);
  const savedApi = localStorage.getItem(storageKey);
  if (savedApi && apiUrlInput) {
    const shouldIgnoreSavedLocalhost = !isCurrentHostLocal && isLoopbackUrl(savedApi);
    if (!shouldIgnoreSavedLocalhost) {
      apiUrlInput.value = savedApi;
    }
  } else if (apiUrlInput && isCurrentHostLocal) {
    apiUrlInput.value = `${window.location.protocol}//${host}:8787`;
  }

  function setStatus(message, isError = false) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#ff9ca9" : "";
  }

  function requestBackgroundMusicFadeOut() {
    document.dispatchEvent(new CustomEvent("site:music-pause-fadeout", {
      detail: { source: "ninconvert-source" }
    }));
  }

  function setBusy(isBusy) {
    const busy = Boolean(isBusy);
    window.__ninconvertBusy = busy;

    if (!convertBtn) {
      return;
    }
    convertBtn.disabled = busy;
    convertBtn.textContent = busy
      ? tr("ninConverting", "Converting...")
      : tr("ninConvertButton", "Convert");
  }

  function normalizeApiBase(url) {
    return (url || "").trim().replace(/\/+$/, "");
  }

  function guessOutputName(inputName, format) {
    const safeName = (inputName || "audio").replace(/\.[a-z0-9]+$/i, "");
    return `${safeName}.${format}`;
  }

  function getLoopSamples() {
    const start = Number(loopStartInput && loopStartInput.value ? loopStartInput.value : 0);
    const end = Number(loopEndInput && loopEndInput.value ? loopEndInput.value : 0);
    return {
      start: Number.isFinite(start) && start >= 0 ? start : 0,
      end: Number.isFinite(end) && end >= 0 ? end : 0
    };
  }

  function getCurrentSamples() {
    if (!sourceAudio) {
      return 0;
    }
    const currentSeconds = Number.isFinite(sourceAudio.currentTime) ? sourceAudio.currentTime : 0;
    return Math.max(0, Math.round(currentSeconds * sourceSampleRate));
  }

  function updatePreviewMeta() {
    if (!previewMeta || !sourceAudio) {
      return;
    }
    const currentSeconds = Number.isFinite(sourceAudio.currentTime) ? sourceAudio.currentTime : 0;
    const currentSamples = Math.max(0, Math.round(currentSeconds * sourceSampleRate));
    previewMeta.textContent = `Position: ${currentSeconds.toFixed(3)}s | ${currentSamples} samples | ${Math.round(sourceSampleRate)} Hz`;
  }

  function setLoopPreviewButtonState() {
    if (!loopPreviewBtn) {
      return;
    }
    loopPreviewBtn.textContent = loopPreviewEnabled
      ? tr("ninLoopPreviewOn", "Loop preview: ON")
      : tr("ninLoopPreviewOff", "Loop preview: OFF");
    loopPreviewBtn.classList.toggle("is-active", loopPreviewEnabled);
  }

  function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function updateCustomPlayerUi() {
    if (!sourceAudio) {
      return;
    }
    if (sourcePlayBtn) {
      sourcePlayBtn.textContent = sourceAudio.paused
        ? tr("ninSourcePlay", "Play")
        : tr("ninSourcePause", "Pause");
    }
    const duration = Number.isFinite(sourceAudio.duration) ? sourceAudio.duration : 0;
    const current = Number.isFinite(sourceAudio.currentTime) ? sourceAudio.currentTime : 0;
    if (sourceTime) {
      sourceTime.textContent = `${formatClock(current)} / ${formatClock(duration)}`;
    }
    if (sourceSeek) {
      const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
      sourceSeek.value = String(Math.round(ratio * 1000));
    }
  }

  function enforceLoopPreview() {
    if (!loopPreviewEnabled || !sourceAudio) {
      return;
    }
    const loop = getLoopSamples();
    if (loop.end <= loop.start) {
      return;
    }
    const startSec = loop.start / sourceSampleRate;
    const endSec = loop.end / sourceSampleRate;
    if (sourceAudio.currentTime >= endSec) {
      sourceAudio.currentTime = startSec;
    }
  }

  async function detectSampleRate(file) {
    if (!file || typeof file.arrayBuffer !== "function") {
      sourceSampleRate = 48000;
      updatePreviewMeta();
      return;
    }

    try {
      if (!audioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          audioContext = new Ctx();
        }
      }
      if (!audioContext) {
        sourceSampleRate = 48000;
        updatePreviewMeta();
        return;
      }
      const buffer = await file.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(buffer.slice(0));
      sourceSampleRate = decoded && Number.isFinite(decoded.sampleRate) ? decoded.sampleRate : 48000;
    } catch (_) {
      sourceSampleRate = 48000;
    }
    updatePreviewMeta();
  }

  function getFileExtension(name) {
    const value = String(name || "").toLowerCase();
    const index = value.lastIndexOf(".");
    return index >= 0 ? value.slice(index + 1) : "";
  }

  function isSupportedInputFile(file) {
    if (!file) {
      return false;
    }
    return allowedInputExtensions.has(getFileExtension(file.name));
  }

  async function applySelectedFile(file) {
    if (!sourceAudio) {
      return;
    }

    if (!file) {
      if (sourceObjectUrl) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = "";
      }
      sourceAudio.removeAttribute("src");
      sourceAudio.load();
      updatePreviewMeta();
      updateCustomPlayerUi();
      return;
    }

    if (!isSupportedInputFile(file)) {
      setStatus(tr("ninStatusUnsupportedInput", "Format non supporte. Utilise WAV, MP3 ou OGG."), true);
      return;
    }

    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
    }
    sourceObjectUrl = URL.createObjectURL(file);
    sourceAudio.src = sourceObjectUrl;
    sourceAudio.load();
    sourceAudio.currentTime = 0;

    await detectSampleRate(file);
    updatePreviewMeta();
    updateCustomPlayerUi();
    setStatus(tr("ninStatusIdle", "En attente d'un fichier."));
  }

  if (fileInput && sourceAudio) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      await applySelectedFile(file);
    });
  }

  if (dropzone && fileInput) {
    const stopEvent = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        stopEvent(event);
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        stopEvent(event);
        if (eventName !== "drop") {
          dropzone.classList.remove("is-dragover");
        }
      });
    });

    dropzone.addEventListener("drop", async (event) => {
      dropzone.classList.remove("is-dragover");
      const files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : null;
      const file = files && files[0] ? files[0] : null;
      if (!file) {
        return;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      await applySelectedFile(file);
    });

    dropzone.addEventListener("click", () => {
      fileInput.click();
    });

    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
  }

  if (sourceAudio) {
    sourceAudio.addEventListener("loadedmetadata", () => {
      updatePreviewMeta();
      updateCustomPlayerUi();
    });
    sourceAudio.addEventListener("timeupdate", () => {
      updatePreviewMeta();
      enforceLoopPreview();
      updateCustomPlayerUi();
    });
    sourceAudio.addEventListener("play", () => {
      requestBackgroundMusicFadeOut();
      if (!loopPreviewEnabled) {
        updateCustomPlayerUi();
      } else {
        const loop = getLoopSamples();
        if (loop.end > loop.start) {
          const startSec = loop.start / sourceSampleRate;
          if (sourceAudio.currentTime < startSec) {
            sourceAudio.currentTime = startSec;
          }
        }
      }
      updateCustomPlayerUi();
    });
    sourceAudio.addEventListener("pause", updateCustomPlayerUi);
    sourceAudio.addEventListener("ended", updateCustomPlayerUi);
  }

  if (sourcePlayBtn && sourceAudio) {
    sourcePlayBtn.addEventListener("click", async () => {
      if (!sourceAudio.src) {
        setStatus(tr("ninStatusPickFileFirst", "Choisis un fichier audio d'abord."), true);
        return;
      }
      try {
        if (sourceAudio.paused) {
          await sourceAudio.play();
        } else {
          sourceAudio.pause();
        }
      } catch (_) {
        // Ignore playback promise issues.
      }
      updateCustomPlayerUi();
    });
  }

  if (sourceSeek && sourceAudio) {
    sourceSeek.addEventListener("input", () => {
      const duration = Number.isFinite(sourceAudio.duration) ? sourceAudio.duration : 0;
      if (duration <= 0) {
        return;
      }
      const ratio = Number(sourceSeek.value) / 1000;
      sourceAudio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
      updatePreviewMeta();
      updateCustomPlayerUi();
    });
  }

  if (setLoopStartBtn) {
    setLoopStartBtn.addEventListener("click", () => {
      const sample = getCurrentSamples();
      loopStartInput.value = String(sample);
      const loop = getLoopSamples();
      if (loop.end > 0 && loop.end < loop.start) {
        loopEndInput.value = String(loop.start);
      }
      updatePreviewMeta();
    });
  }

  if (setLoopEndBtn) {
    setLoopEndBtn.addEventListener("click", () => {
      const sample = getCurrentSamples();
      const loop = getLoopSamples();
      loopEndInput.value = String(Math.max(loop.start, sample));
      updatePreviewMeta();
    });
  }

  if (loopPreviewBtn) {
    loopPreviewBtn.addEventListener("click", () => {
      loopPreviewEnabled = !loopPreviewEnabled;
      if (loopPreviewEnabled && loopEnabledInput) {
        loopEnabledInput.checked = true;
      }
      setLoopPreviewButtonState();
    });
  }

  [loopStartInput, loopEndInput].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener("input", updatePreviewMeta);
  });

  setLoopPreviewButtonState();
  updatePreviewMeta();
  updateCustomPlayerUi();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    downloadLink.hidden = true;
    downloadLink.removeAttribute("href");

    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!file) {
      setStatus(tr("ninStatusPickFileBeforeConvert", "Choisis un fichier audio avant de convertir."), true);
      return;
    }

    const format = (formatInput && formatInput.value ? formatInput.value : "").toLowerCase().trim();
    if (!format) {
      setStatus(tr("ninStatusPickOutputFormat", "Choisis un format de sortie."), true);
      return;
    }

    const apiBase = normalizeApiBase(apiUrlInput ? apiUrlInput.value : "");
    if (!apiBase) {
      setStatus(tr("ninStatusMissingApi", "Ajoute ton URL API d'abord (backend NinConvert)."), true);
      return;
    }

    localStorage.setItem(storageKey, apiBase);

    const formData = new FormData();
    formData.append("audio", file, file.name);
    formData.append("format", format);
    formData.append("loopEnabled", loopEnabledInput && loopEnabledInput.checked ? "1" : "0");
    formData.append("loopStart", loopStartInput && loopStartInput.value ? loopStartInput.value : "0");
    formData.append("loopEnd", loopEndInput && loopEndInput.value ? loopEndInput.value : "0");

    setBusy(true);
    setStatus(tr("ninStatusConverting", "Conversion en cours..."));

    try {
      const response = await fetch(`${apiBase}/convert`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const fallbackName = guessOutputName(file.name, format);
      const contentDisposition = response.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
      const outputName = match && match[1] ? match[1] : fallbackName;
      const objectUrl = URL.createObjectURL(blob);

      downloadLink.href = objectUrl;
      downloadLink.download = outputName;
      downloadLink.hidden = false;
      setStatus(tr("ninStatusDone", "Conversion terminee. Clique sur Download."));
    } catch (error) {
      setStatus(`${tr("ninStatusErrorPrefix", "Erreur conversion:")} ${error.message || tr("ninStatusUnknownError", "unknown error")}`, true);
    } finally {
      setBusy(false);
    }
  });

  function refreshLocalizedUi() {
    if (downloadLink) {
      downloadLink.textContent = tr("ninDownload", "Download");
    }
    setBusy(Boolean(window.__ninconvertBusy));
    setLoopPreviewButtonState();
    updateCustomPlayerUi();
  }

  document.addEventListener("site:language-updated", refreshLocalizedUi);
  refreshLocalizedUi();
})();
