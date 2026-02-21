(() => {
  const form = document.getElementById("ninconvert-form");
  if (!form) {
    return;
  }

  const fileInput = document.getElementById("nin-file");
  const dropzone = document.getElementById("nin-dropzone");
  const dropzoneFileNode = document.getElementById("nin-dropzone-file");
  const formatInput = document.getElementById("nin-format");
  const channelsInput = document.getElementById("nin-channels");
  const sampleRateInput = document.getElementById("nin-sample-rate");
  const loopEnabledInput = document.getElementById("nin-loop-enabled");
  const loopStartInput = document.getElementById("nin-loop-start");
  const loopEndInput = document.getElementById("nin-loop-end");
  const sourceAudio = document.getElementById("nin-source-audio");
  const sourcePlayBtn = document.getElementById("nin-source-play-btn");
  const sourceSeek = document.getElementById("nin-source-seek");
  const loopMarkerStart = document.getElementById("nin-loop-marker-start");
  const loopMarkerEnd = document.getElementById("nin-loop-marker-end");
  const sourceTime = document.getElementById("nin-source-time");
  const previewMeta = document.getElementById("nin-preview-meta");
  const setLoopStartBtn = document.getElementById("nin-set-loop-start");
  const setLoopEndBtn = document.getElementById("nin-set-loop-end");
  const loopPreviewBtn = document.getElementById("nin-loop-preview-btn");
  const apiUrlInput = document.getElementById("nin-api-url");
  const convertBtn = document.getElementById("nin-convert-btn");
  const statusNode = document.getElementById("nin-status");
  const downloadLink = document.getElementById("nin-download");
  const progressWrap = document.getElementById("nin-progress-wrap");
  const progressLabel = document.getElementById("nin-progress-label");
  const progressValue = document.getElementById("nin-progress-value");
  const progressFill = document.getElementById("nin-progress-fill");
  const progressTrack = progressWrap ? progressWrap.querySelector(".nin-progress-track") : null;

  const storageKey = "ninconvert-api-url";
  const translations = window.SITE_TRANSLATIONS || {};
  const assetRoot = (() => {
    const raw = document.body && document.body.dataset ? (document.body.dataset.assetRoot || "assets/") : "assets/";
    return raw.endsWith("/") ? raw : `${raw}/`;
  })();
  const apiConfigPath = `${assetRoot}config/ninconvert-api.json`;
  let sourceObjectUrl = "";
  let sourceSampleRate = 48000;
  let loopPreviewEnabled = false;
  let audioContext = null;
  let selectedInputFile = null;
  let loopStartMarkerSet = false;
  let loopEndMarkerSet = false;
  let draggingLoopMarker = "";
  let isApiHealthy = false;
  let healthCheckTimer = 0;
  const seekThumbWidthPx = 4;
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

  async function fetchApiConfigValue() {
    try {
      const response = await fetch(`${apiConfigPath}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        return "";
      }
      const data = await response.json();
      if (!data || typeof data.apiBaseUrl !== "string") {
        return "";
      }
      return normalizeApiBase(data.apiBaseUrl);
    } catch (_) {
      return "";
    }
  }

  async function checkApiHealth(apiBase) {
    if (!apiBase) {
      return false;
    }
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), 4500)
        : 0;

      const response = await fetch(`${apiBase}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function setBackendOfflineStatus() {
    setStatus(
      tr(
        "ninStatusBackendOffline",
        "LE BACKEND est pas ouvert, veuillez reessayer plus tard."
      ),
      true
    );
  }

  async function syncApiFromConfigAndHealth() {
    if (!apiUrlInput) {
      return;
    }

    const configApi = await fetchApiConfigValue();
    if (configApi && (!apiUrlInput.value || !savedApi || !isCurrentHostLocal)) {
      apiUrlInput.value = configApi;
      localStorage.setItem(storageKey, configApi);
    }

    const apiBase = normalizeApiBase(apiUrlInput.value || "");
    if (!apiBase) {
      isApiHealthy = false;
      setBackendOfflineStatus();
      updateActionAvailability();
      return;
    }

    const online = await checkApiHealth(apiBase);
    isApiHealthy = online;
    if (!online) {
      setBackendOfflineStatus();
    } else {
      setStatus(tr("ninStatusIdle", "En attente d'un fichier."));
    }
    updateActionAvailability();
  }

  function setStatus(message, isError = false) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#ff9ca9" : "";
  }

  function setDropzoneFileName(fileName) {
    if (!dropzoneFileNode) {
      return;
    }
    if (!fileName) {
      dropzoneFileNode.textContent = tr("ninDropzoneFileNone", "Aucun fichier selectionne.");
      return;
    }
    dropzoneFileNode.textContent = `${tr("ninDropzoneFilePicked", "Fichier:")} ${fileName}`;
  }

  function setProgressVisible(visible) {
    if (!progressWrap) {
      return;
    }
    progressWrap.hidden = !visible;
  }

  function setProgress(percent, labelText) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));

    if (progressFill) {
      progressFill.style.width = `${value}%`;
    }
    if (progressValue) {
      progressValue.textContent = `${value}%`;
    }
    if (progressLabel && labelText) {
      progressLabel.textContent = labelText;
    }
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", String(value));
    }
  }

  function resetProgress() {
    setProgressVisible(false);
    setProgress(0, tr("ninProgressPrepare", "Preparation du fichier..."));
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

  function hasSelectedFile() {
    const fileFromInput = fileInput && fileInput.files ? fileInput.files[0] : null;
    return Boolean(selectedInputFile || fileFromInput);
  }

  function setDownloadEnabled(enabled) {
    if (!downloadLink) {
      return;
    }
    const on = Boolean(enabled);
    downloadLink.classList.toggle("is-disabled", !on);
    downloadLink.setAttribute("aria-disabled", on ? "false" : "true");
    if (!on) {
      downloadLink.removeAttribute("href");
      downloadLink.removeAttribute("download");
    }
  }

  function updateActionAvailability() {
    const apiBase = normalizeApiBase(apiUrlInput ? apiUrlInput.value : "");
    const canConvert = hasSelectedFile() && Boolean(apiBase) && isApiHealthy && !Boolean(window.__ninconvertBusy);
    if (convertBtn) {
      convertBtn.disabled = !canConvert;
      convertBtn.classList.toggle("is-disabled", !canConvert);
    }
  }

  function normalizeApiBase(url) {
    return (url || "").trim().replace(/\/+$/, "");
  }

  function convertViaXhr(url, formData, onUploadProgress, onUploadDone) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.responseType = "blob";

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (!onUploadProgress) {
            return;
          }
          if (event.lengthComputable && event.total > 0) {
            onUploadProgress(event.loaded / event.total);
          } else {
            onUploadProgress(null);
          }
        };
        xhr.upload.onload = () => {
          if (onUploadDone) {
            onUploadDone();
          }
        };
      }

      xhr.onerror = () => {
        reject(new Error("Network error"));
      };

      const safeGetHeader = (name) => {
        try {
          return xhr.getResponseHeader(name) || "";
        } catch (_) {
          return "";
        }
      };

      xhr.onload = async () => {
        const status = xhr.status;
        const responseBlob = xhr.response instanceof Blob ? xhr.response : new Blob([]);
        const contentDisposition = safeGetHeader("content-disposition");

        if (status >= 200 && status < 300) {
          resolve({
            blob: responseBlob,
            contentDisposition,
            wavChannels: safeGetHeader("x-ninconvert-wav-channels"),
            wavSampleRate: safeGetHeader("x-ninconvert-wav-sample-rate"),
            loopMode: safeGetHeader("x-ninconvert-loop-mode"),
            encoderLoopArgs: safeGetHeader("x-ninconvert-encoder-loop-args"),
            waveLoopEndMode: safeGetHeader("x-ninconvert-wave-loop-end-mode"),
            loopEndMode: safeGetHeader("x-ninconvert-loop-end-mode")
          });
          return;
        }

        let errorMessage = `HTTP ${status}`;
        try {
          const text = await responseBlob.text();
          if (text) {
            errorMessage = text;
          }
        } catch (_) {
          // Keep fallback error.
        }
        reject(new Error(errorMessage));
      };

      xhr.send(formData);
    });
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

  function updateLoopMarkerFlags() {
    loopStartMarkerSet = Boolean(loopStartInput && loopStartInput.dataset.set === "1");
    loopEndMarkerSet = Boolean(loopEndInput && loopEndInput.dataset.set === "1");
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getSeekGeometry() {
    if (!sourceSeek) {
      return null;
    }
    const seekWrap = sourceSeek.parentElement;
    const wrapRect = seekWrap && typeof seekWrap.getBoundingClientRect === "function"
      ? seekWrap.getBoundingClientRect()
      : null;
    const seekRect = typeof sourceSeek.getBoundingClientRect === "function"
      ? sourceSeek.getBoundingClientRect()
      : null;
    const wrapWidth = Math.max(1, wrapRect ? wrapRect.width : (seekWrap ? (seekWrap.clientWidth || 1) : 1));
    const seekWidth = Math.max(1, seekRect ? seekRect.width : (sourceSeek.clientWidth || sourceSeek.offsetWidth || 1));
    const seekOffsetX = wrapRect && seekRect
      ? clampNumber(seekRect.left - wrapRect.left, 0, wrapWidth)
      : 0;
    const thumbHalf = seekThumbWidthPx / 2;
    const travel = Math.max(1, seekWidth - seekThumbWidthPx);

    return {
      seekWrap,
      wrapRect,
      wrapWidth,
      seekWidth,
      seekOffsetX,
      thumbHalf,
      travel
    };
  }

  function getTimelineInfo() {
    const duration = Number.isFinite(sourceAudio && sourceAudio.duration) ? sourceAudio.duration : 0;
    if (duration <= 0 || !Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
      return null;
    }
    const totalSamples = Math.max(1, Math.round(duration * sourceSampleRate));
    return { duration, totalSamples };
  }

  function readLoopInputValue(input) {
    const parsed = Number.parseInt(String(input && input.value ? input.value : "0"), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function getSampleFromPointerClientX(clientX) {
    const geometry = getSeekGeometry();
    const timeline = getTimelineInfo();
    if (!geometry || !timeline || !geometry.wrapRect) {
      return null;
    }

    const seekLocalX = clientX - geometry.wrapRect.left - geometry.seekOffsetX;
    const clampedLocalX = clampNumber(seekLocalX, 0, geometry.seekWidth);
    const ratio = geometry.seekWidth > 0 ? (clampedLocalX / geometry.seekWidth) : 0;
    const sample = Math.round(ratio * timeline.totalSamples);

    return {
      sample: clampNumber(sample, 0, timeline.totalSamples - 1),
      totalSamples: timeline.totalSamples
    };
  }

  function applyDraggedLoopMarker(markerName, sample, totalSamples) {
    if (!loopStartInput || !loopEndInput) {
      return;
    }

    const maxSample = Math.max(0, totalSamples - 1);

    if (markerName === "start") {
      let startSample = clampNumber(sample, 0, maxSample);
      const endSample = readLoopInputValue(loopEndInput);
      if (loopEndMarkerSet) {
        startSample = Math.min(startSample, Math.max(0, endSample - 1));
      }
      loopStartInput.value = String(startSample);
      loopStartInput.dataset.set = "1";
      loopStartMarkerSet = true;
    } else if (markerName === "end") {
      let endSample = clampNumber(sample, 0, maxSample);
      const startSample = readLoopInputValue(loopStartInput);
      const minEndSample = loopStartMarkerSet ? Math.max(1, startSample + 1) : 1;
      endSample = Math.max(minEndSample, endSample);
      loopEndInput.value = String(endSample);
      loopEndInput.dataset.set = "1";
      loopEndMarkerSet = true;
    } else {
      return;
    }

    updatePreviewMeta();
    updateLoopMarkers();
  }

  function handleLoopMarkerPointerMove(event) {
    if (!draggingLoopMarker) {
      return;
    }
    const timelinePointer = getSampleFromPointerClientX(event.clientX);
    if (!timelinePointer) {
      return;
    }
    event.preventDefault();
    applyDraggedLoopMarker(draggingLoopMarker, timelinePointer.sample, timelinePointer.totalSamples);
  }

  function stopLoopMarkerDragging() {
    if (!draggingLoopMarker) {
      return;
    }
    draggingLoopMarker = "";
    window.removeEventListener("pointermove", handleLoopMarkerPointerMove);
    window.removeEventListener("pointerup", stopLoopMarkerDragging);
    window.removeEventListener("pointercancel", stopLoopMarkerDragging);
  }

  function startLoopMarkerDragging(markerName, event) {
    if (!markerName) {
      return;
    }
    const timelinePointer = getSampleFromPointerClientX(event.clientX);
    if (!timelinePointer) {
      return;
    }
    event.preventDefault();
    draggingLoopMarker = markerName;
    applyDraggedLoopMarker(markerName, timelinePointer.sample, timelinePointer.totalSamples);
    window.addEventListener("pointermove", handleLoopMarkerPointerMove);
    window.addEventListener("pointerup", stopLoopMarkerDragging);
    window.addEventListener("pointercancel", stopLoopMarkerDragging);
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
    updateLoopMarkers();
  }

  function updateLoopMarkers() {
    if (!loopMarkerStart || !loopMarkerEnd || !sourceAudio || !sourceSampleRate) {
      return;
    }

    const duration = Number.isFinite(sourceAudio.duration) ? sourceAudio.duration : 0;
    if (duration <= 0) {
      loopMarkerStart.style.opacity = "0";
      loopMarkerEnd.style.opacity = "0";
      return;
    }

    const totalSamples = Math.max(1, Math.round(duration * sourceSampleRate));
    const loop = getLoopSamples();
    updateLoopMarkerFlags();

    const startRatio = Math.max(0, Math.min(1, loop.start / totalSamples));
    const endRatio = Math.max(0, Math.min(1, loop.end / totalSamples));
    const geometry = getSeekGeometry();
    if (!geometry) {
      loopMarkerStart.style.opacity = "0";
      loopMarkerEnd.style.opacity = "0";
      return;
    }

    const setMarkerPosition = (node, ratio, visible) => {
      if (!node) {
        return;
      }
      if (!visible) {
        node.style.opacity = "0";
        node.style.pointerEvents = "none";
        return;
      }
      const pixelX = geometry.seekOffsetX + geometry.thumbHalf + (Math.max(0, Math.min(1, ratio)) * geometry.travel);
      const clampedPixelX = clampNumber(pixelX, 0, geometry.wrapWidth);
      const percentX = (clampedPixelX / geometry.wrapWidth) * 100;
      node.style.left = `${percentX}%`;
      node.style.transform = "translateX(-50%)";
      node.style.opacity = "1";
      node.style.pointerEvents = "auto";
    };

    setMarkerPosition(loopMarkerStart, startRatio, loopStartMarkerSet);
    setMarkerPosition(loopMarkerEnd, endRatio, loopEndMarkerSet);
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
      selectedInputFile = null;
      setDropzoneFileName("");
      if (sourceObjectUrl) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = "";
      }
      sourceAudio.removeAttribute("src");
      sourceAudio.load();
      updatePreviewMeta();
      updateCustomPlayerUi();
      updateActionAvailability();
      return;
    }

    if (!isSupportedInputFile(file)) {
      selectedInputFile = null;
      setDropzoneFileName("");
      setStatus(tr("ninStatusUnsupportedInput", "Format non supporte. Utilise WAV, MP3 ou OGG."), true);
      updateActionAvailability();
      return;
    }
    selectedInputFile = file;
    setDropzoneFileName(file.name || "");

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
    updateLoopMarkers();
    setStatus(tr("ninStatusIdle", "En attente d'un fichier."));
    updateActionAvailability();
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

      // Best effort sync with the native input when browser permits it.
      try {
        if (typeof DataTransfer !== "undefined") {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
        }
      } catch (_) {
        // Ignore: selectedInputFile keeps drag & drop working anyway.
      }
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

  if (loopMarkerStart) {
    loopMarkerStart.addEventListener("pointerdown", (event) => {
      startLoopMarkerDragging("start", event);
    });
  }

  if (loopMarkerEnd) {
    loopMarkerEnd.addEventListener("pointerdown", (event) => {
      startLoopMarkerDragging("end", event);
    });
  }

  if (setLoopStartBtn) {
    setLoopStartBtn.addEventListener("click", () => {
      const sample = getCurrentSamples();
      loopStartInput.value = String(sample);
      loopStartInput.dataset.set = "1";
      loopStartMarkerSet = true;
      const loop = getLoopSamples();
      if (loop.end > 0 && loop.end < loop.start) {
        loopEndInput.value = String(loop.start);
        loopEndInput.dataset.set = "1";
        loopEndMarkerSet = true;
      }
      updatePreviewMeta();
      updateLoopMarkers();
    });
  }

  if (setLoopEndBtn) {
    setLoopEndBtn.addEventListener("click", () => {
      const sample = getCurrentSamples();
      const loop = getLoopSamples();
      loopEndInput.value = String(Math.max(loop.start, sample));
      loopEndInput.dataset.set = "1";
      loopEndMarkerSet = true;
      updatePreviewMeta();
      updateLoopMarkers();
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
    input.addEventListener("input", () => {
      input.dataset.set = String(String(input.value || "").trim().length > 0 ? 1 : 0);
      loopStartMarkerSet = Boolean(loopStartInput && loopStartInput.dataset.set === "1");
      loopEndMarkerSet = Boolean(loopEndInput && loopEndInput.dataset.set === "1");
      updatePreviewMeta();
      updateLoopMarkers();
    });
  });

  window.addEventListener("resize", updateLoopMarkers);
  if (typeof ResizeObserver !== "undefined" && sourceSeek) {
    const seekResizeObserver = new ResizeObserver(() => {
      updateLoopMarkers();
    });
    seekResizeObserver.observe(sourceSeek);
    if (sourceSeek.parentElement) {
      seekResizeObserver.observe(sourceSeek.parentElement);
    }
  }
  window.requestAnimationFrame(() => {
    updateLoopMarkers();
  });

  setLoopPreviewButtonState();
  if (loopStartInput && !loopStartInput.dataset.set) {
    loopStartInput.dataset.set = "0";
  }
  if (loopEndInput && !loopEndInput.dataset.set) {
    loopEndInput.dataset.set = "0";
  }
  updatePreviewMeta();
  updateCustomPlayerUi();
  setDropzoneFileName("");
  setDownloadEnabled(false);
  updateActionAvailability();
  resetProgress();
  void syncApiFromConfigAndHealth();

  if (apiUrlInput) {
    apiUrlInput.addEventListener("input", () => {
      isApiHealthy = false;
      updateActionAvailability();
      if (healthCheckTimer) {
        window.clearTimeout(healthCheckTimer);
      }
      healthCheckTimer = window.setTimeout(async () => {
        const apiBase = normalizeApiBase(apiUrlInput.value || "");
        if (!apiBase) {
          isApiHealthy = false;
          setBackendOfflineStatus();
          updateActionAvailability();
          return;
        }
        const online = await checkApiHealth(apiBase);
        isApiHealthy = online;
        if (!online) {
          setBackendOfflineStatus();
        } else {
          setStatus(tr("ninStatusIdle", "En attente d'un fichier."));
        }
        updateActionAvailability();
      }, 380);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setDownloadEnabled(false);

    const fileFromInput = fileInput && fileInput.files ? fileInput.files[0] : null;
    const file = selectedInputFile || fileFromInput || null;
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
      setBackendOfflineStatus();
      return;
    }

    localStorage.setItem(storageKey, apiBase);
    const backendOnline = await checkApiHealth(apiBase);
    isApiHealthy = backendOnline;
    updateActionAvailability();
    if (!backendOnline) {
      setBackendOfflineStatus();
      return;
    }

    const formData = new FormData();
    formData.append("audio", file, file.name);
    formData.append("format", format);
    formData.append("channels", channelsInput && channelsInput.value ? channelsInput.value : "2");
    formData.append("sampleRate", sampleRateInput && sampleRateInput.value ? sampleRateInput.value : "48000");
    formData.append("loopEnabled", loopEnabledInput && loopEnabledInput.checked ? "1" : "0");
    formData.append("loopMode", "metadata");
    formData.append("loopStart", loopStartInput && loopStartInput.value ? loopStartInput.value : "0");
    formData.append("loopEnd", loopEndInput && loopEndInput.value ? loopEndInput.value : "0");

    setBusy(true);
    setProgressVisible(true);
    setProgress(4, tr("ninProgressPrepare", "Preparation du fichier..."));
    setStatus(tr("ninStatusConverting", "Conversion en cours..."));

    let encodeProgress = 60;
    let encodeTicker = null;

    const startEncodeTicker = () => {
      if (encodeTicker) {
        return;
      }
      setProgress(60, tr("ninProgressEncoding", "Encodage Nintendo en cours..."));
      encodeTicker = window.setInterval(() => {
        encodeProgress = Math.min(94, encodeProgress + Math.random() * 2.2);
        setProgress(encodeProgress, tr("ninProgressEncoding", "Encodage Nintendo en cours..."));
      }, 260);
    };

    try {
      const result = await convertViaXhr(
        `${apiBase}/convert`,
        formData,
        (ratio) => {
          if (typeof ratio === "number") {
            const uploadPct = 8 + ratio * 44;
            setProgress(uploadPct, tr("ninProgressUpload", "Upload du fichier..."));
          }
        },
        () => {
          startEncodeTicker();
        }
      );

      if (encodeTicker) {
        window.clearInterval(encodeTicker);
        encodeTicker = null;
      }
      setProgress(98, tr("ninProgressFinalize", "Finalisation du fichier converti..."));

      const blob = result.blob;
      const fallbackName = guessOutputName(file.name, format);
      const contentDisposition = result.contentDisposition || "";
      const match = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
      const outputName = match && match[1] ? match[1] : fallbackName;
      const objectUrl = URL.createObjectURL(blob);

      downloadLink.href = objectUrl;
      downloadLink.download = outputName;
      setDownloadEnabled(true);
      setProgress(100, tr("ninProgressDone", "Conversion terminee"));
      const wavChannels = Number.parseInt(String(result.wavChannels || ""), 10);
      const wavSampleRate = Number.parseInt(String(result.wavSampleRate || ""), 10);
      const statusParts = [tr("ninStatusDone", "Conversion terminee. Clique sur Download.")];
      if (Number.isFinite(wavChannels) && wavChannels > 0) {
        statusParts.push(`WAV: ${wavChannels} ch`);
      }
      if (Number.isFinite(wavSampleRate) && wavSampleRate > 0) {
        statusParts.push(`${wavSampleRate} Hz`);
      }
      if (result.loopMode) {
        statusParts.push(`loop=${String(result.loopMode)}`);
      }
      if (result.encoderLoopArgs) {
        statusParts.push(`loopArgs=${String(result.encoderLoopArgs)}`);
      }
      if (result.waveLoopEndMode) {
        statusParts.push(`waveLoopEnd=${String(result.waveLoopEndMode)}`);
      }
      if (result.loopEndMode) {
        statusParts.push(`loopEndMode=${String(result.loopEndMode)}`);
      }
      setStatus(statusParts.join(" | "));
    } catch (error) {
      if (encodeTicker) {
        window.clearInterval(encodeTicker);
        encodeTicker = null;
      }
      setStatus(`${tr("ninStatusErrorPrefix", "Erreur conversion:")} ${error.message || tr("ninStatusUnknownError", "unknown error")}`, true);
    } finally {
      setBusy(false);
      updateActionAvailability();
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
