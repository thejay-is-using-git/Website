(() => {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const animatedSections = Array.from(document.querySelectorAll(".dev-banner, main.page"));
  const musicBtn = document.getElementById("music-btn");
  const musicPanel = document.getElementById("music-panel");
  const musicNow = musicPanel ? musicPanel.querySelector(".music-now") : null;
  const musicAudio = document.getElementById("music-audio");
  const musicCover = document.querySelector(".music-cover");
  const musicTrackTitle = document.getElementById("music-track-title");
  const musicTrackComposer = document.getElementById("music-track-composer");
  const musicProgress = document.getElementById("music-progress");
  const musicCurrentTime = document.getElementById("music-current-time");
  const musicDuration = document.getElementById("music-duration");
  const musicPlayBtn = document.getElementById("music-play-btn");
  const musicPlayIcon = document.getElementById("music-play-icon");
  const musicPrevBtn = document.getElementById("music-prev-btn");
  const musicNextBtn = document.getElementById("music-next-btn");
  const musicMuteBtn = document.getElementById("music-mute-btn");
  const musicMuteIcon = document.getElementById("music-mute-icon");
  const musicVolume = document.getElementById("music-volume");
  const musicQueueBtn = document.getElementById("music-queue-btn");
  const musicQueuePanel = document.getElementById("music-queue-panel");
  const musicQueueTitle = document.getElementById("music-queue-title");
  const musicShuffleBtn = document.getElementById("music-shuffle-btn");
  const musicQueueList = document.getElementById("music-queue-list");

  const themeSelect = document.getElementById("theme-select");
  const langSelect = document.getElementById("lang-select");
  const brandTitle = document.getElementById("brand-title");
  const root = document.documentElement;
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const textFxTimers = new WeakMap();
  const translations = window.SITE_TRANSLATIONS || {};
  let activeTranslation = translations.fr || {};

  let closeTimer = null;
  let musicCloseTimer = null;
  let brandTypeTimer = null;
  let tabTitleTimer = null;
  let nowPlayingSwapTimer = null;
  let starnightContainer = null;

  const pageName = document.body.dataset.page || "information";
  const lastPageStorageKey = "site-last-page";
  const pendingFromStorageKey = "site-pending-from";
  const pendingTargetStorageKey = "site-pending-target";
  const musicTrackStorageKey = "site-music-track";
  const musicVolumeStorageKey = "site-music-volume";
  const musicMuteStorageKey = "site-music-muted";
  const musicStateStorageKey = "site-music-state";
  const musicAutoStartStorageKey = "site-music-autostart";
  const isNestedPage = /\/(resources|credit|ninconvert|placeholder)(\/|$)/i.test(window.location.pathname || "");
  const assetRoot = isNestedPage ? "../assets/" : "assets/";
  const iconBasePath = `${assetRoot}images/icons/`;
  const musicBasePath = `${assetRoot}Musics/`;
  const fallbackCoverSrc = `${assetRoot}images/album-placeholder.svg`;

  const titleByPage = {
    information: "Website",
    ressources: "Resources",
    credit: "Credit",
    ninconvert: "NinConvert",
    placeholder: "Placeholder"
  };
  const tabTitleByPage = {
    information: "Home",
    ressources: "Resources",
    credit: "Credit",
    ninconvert: "NinConvert",
    placeholder: "Placeholder"
  };
  const pathToPage = {
    "index.html": "information",
    "resources": "ressources",
    "resources.html": "ressources",
    "credit": "credit",
    "credit.html": "credit",
    "ninconvert": "ninconvert",
    "ninconvert.html": "ninconvert",
    "placeholder": "placeholder",
    "placeholder.html": "placeholder"
  };

  const defaultCoverSrc = musicCover ? musicCover.src : fallbackCoverSrc;
  const playlist = [];
  const brokenTrackUrls = new Set();
  const musicFadeInMs = 520;
  const musicFadeOutMs = 380;
  let currentTrackIndex = 0;
  let pendingAutoplay = false;
  let pendingAutoplayUrl = "";
  let musicFadeRaf = 0;
  let musicDesiredVolume = 1;

  function getPageFromHref(href) {
    if (!href) {
      return null;
    }

    try {
      const url = new URL(href, window.location.href);
      const normalizedPath = url.pathname.replace(/\/+$/, "");
      const filename = normalizedPath.split("/").pop() || "index.html";
      return pathToPage[filename] || null;
    } catch (_) {
      return null;
    }
  }

  function getPreviousPageName() {
    const pendingTarget = sessionStorage.getItem(pendingTargetStorageKey);
    const pendingFrom = sessionStorage.getItem(pendingFromStorageKey);
    if (pendingTarget === pageName && Object.prototype.hasOwnProperty.call(titleByPage, pendingFrom)) {
      return pendingFrom;
    }

    const referrerPage = getPageFromHref(document.referrer);
    if (referrerPage && referrerPage !== pageName) {
      return referrerPage;
    }

    const storedLastPage = sessionStorage.getItem(lastPageStorageKey);
    if (Object.prototype.hasOwnProperty.call(titleByPage, storedLastPage) && storedLastPage !== pageName) {
      return storedLastPage;
    }

    return null;
  }

  const previousPageName = getPreviousPageName();
  const hasKnownLastPage = Boolean(previousPageName);
  const brandPrefix = "CTRL_J/";
  let currentBrandSuffix = hasKnownLastPage
    ? titleByPage[previousPageName]
    : (brandTitle && brandTitle.textContent.startsWith(brandPrefix)
      ? brandTitle.textContent.slice(brandPrefix.length)
      : "Website");

  function getSystemTheme() {
    return systemThemeQuery.matches ? "dark" : "light";
  }

  function getSystemLanguage() {
    const lang = (navigator.language || "fr").toLowerCase();
    return lang.startsWith("en") ? "en" : "fr";
  }

  function isPageReload() {
    try {
      const navEntries = performance.getEntriesByType("navigation");
      if (Array.isArray(navEntries) && navEntries.length) {
        return navEntries[0].type === "reload";
      }
    } catch (_) {
      // ignore and fallback below
    }
    return Boolean(performance.navigation && performance.navigation.type === 1);
  }

  function applyTheme(themeChoice) {
    const effectiveTheme = themeChoice === "system" ? getSystemTheme() : themeChoice;
    root.setAttribute("data-theme", effectiveTheme);
    setStarnightActive(effectiveTheme === "starnight");
    localStorage.setItem("site-theme", themeChoice);
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function ensureStarnightContainer() {
    if (starnightContainer) {
      return starnightContainer;
    }

    const backgroundContainer = document.createElement("div");
    backgroundContainer.className = "starnight-bg";
    backgroundContainer.setAttribute("aria-hidden", "true");

    for (let i = 0; i < 70; i += 1) {
      const star = document.createElement("span");
      star.className = "starnight-star";
      star.style.top = `${random(0, 100)}%`;
      star.style.left = `${random(0, 100)}%`;
      star.style.opacity = `${Math.random() * 0.7 + 0.2}`;
      star.style.animationDelay = `${(Math.random() * 3.2).toFixed(2)}s`;
      star.style.animationDuration = `${(Math.random() * 2.4 + 2.8).toFixed(2)}s`;
      backgroundContainer.appendChild(star);
    }

    /*
    Pure CSS Shooting Star Animation Effect Copyright (c) 2021 by Delroy Prithvi (https://codepen.io/delroyprithvi/pen/LYyJROR)
    License: MIT
    */
    const shootingLayer = document.createElement("div");
    shootingLayer.className = "starnight-shooting-layer";
    for (let i = 0; i < 10; i += 1) {
      const shootingstar = document.createElement("span");
      shootingstar.className = "shootingstar";
      shootingstar.style.top = `${random(0, 70)}%`;
      shootingstar.style.right = `${random(-5, 100)}%`;
      shootingstar.style.animationDelay = `${(Math.random() * 5).toFixed(2)}s`;
      shootingstar.style.animationDuration = `${(Math.random() * 2 + 1.2).toFixed(2)}s`;
      shootingLayer.appendChild(shootingstar);
    }
    backgroundContainer.appendChild(shootingLayer);

    document.body.appendChild(backgroundContainer);
    starnightContainer = backgroundContainer;
    return starnightContainer;
  }

  function setStarnightActive(active) {
    if (active) {
      const container = ensureStarnightContainer();
      if (!container) {
        return;
      }
      container.classList.add("is-active");
    } else {
      if (!starnightContainer) {
        return;
      }
      const container = starnightContainer;
      container.classList.remove("is-active");
    }
  }

  function animateReplaceText(node, targetText) {
    if (!node) {
      return;
    }

    if (reduceMotionQuery.matches) {
      node.textContent = targetText;
      return;
    }

    const running = textFxTimers.get(node);
    if (running) {
      clearTimeout(running);
    }

    const fadeOutMs = 120;
    const fadeInMs = 160;
    const typeDelayMs = 16;

    node.classList.add("fade-swap");
    node.style.opacity = "0";

    function applyFadeSwap() {
      let writeIndex = 0;
      node.textContent = "";
      node.style.opacity = "1";

      function writeStep() {
        writeIndex += 1;
        node.textContent = targetText.slice(0, writeIndex);
        if (writeIndex < targetText.length) {
          textFxTimers.set(node, setTimeout(writeStep, typeDelayMs));
          return;
        }

        textFxTimers.delete(node);
      }

      textFxTimers.set(node, setTimeout(writeStep, 20));
      textFxTimers.set(node, setTimeout(() => {
        node.classList.remove("fade-swap");
      }, fadeInMs));
    }

    textFxTimers.set(node, setTimeout(applyFadeSwap, fadeOutMs));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function filenameToTitle(url) {
    const raw = (url.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch (_) {
      decoded = raw;
    }
    return decoded.replace(/[_-]+/g, " ").trim() || "Track";
  }

  function getBasename(pathOrUrl) {
    const clean = (pathOrUrl || "").split("?")[0].split("#")[0];
    const base = clean.split("/").pop() || "";
    try {
      return decodeURIComponent(base);
    } catch (_) {
      return base;
    }
  }

  function normalizeTrack(raw, index) {
    if (typeof raw === "string") {
      const url = raw.startsWith("http") || raw.startsWith(musicBasePath) ? raw : `${musicBasePath}${raw}`;
      const coverCandidates = buildCoverCandidates(url, "");
      return {
        id: `${index}-${url}`,
        url,
        requestUrl: encodeTrackUrl(url),
        title: filenameToTitle(url),
        artist: "",
        cover: "",
        coverCandidates
      };
    }

    if (!raw || typeof raw !== "object") {
      return null;
    }

    const fileOrUrl = raw.url || raw.file || raw.src || "";
    if (!fileOrUrl) {
      return null;
    }

    const resolvedFileOrUrl = resolveAssetPath(fileOrUrl);
    const url = resolvedFileOrUrl.startsWith("http") || resolvedFileOrUrl.startsWith(musicBasePath)
      ? resolvedFileOrUrl
      : `${musicBasePath}${resolvedFileOrUrl}`;
    const normalizedCover = normalizeCoverUrl(raw.cover || "");
    const coverCandidates = buildCoverCandidates(url, normalizedCover);

    return {
      id: raw.id || `${index}-${url}`,
      url,
      requestUrl: encodeTrackUrl(url),
      title: raw.title || filenameToTitle(url),
      artist: raw.artist || raw.composer || "",
      cover: normalizedCover,
      coverCandidates
    };
  }

  function encodeTrackUrl(url) {
    if (!url || typeof url !== "string") {
      return "";
    }

    let normalized = url.trim();
    try {
      // Prevent double-encoding (e.g. "%20" becoming "%2520")
      normalized = decodeURI(normalized);
    } catch (_) {
      // keep original when decoding fails
    }

    return encodeURI(normalized).replace(/#/g, "%23");
  }

  function normalizeCoverUrl(cover) {
    if (!cover || typeof cover !== "string") {
      return "";
    }
    const resolvedCover = resolveAssetPath(cover);
    if (
      resolvedCover.startsWith("http") ||
      resolvedCover.startsWith("data:") ||
      resolvedCover.startsWith("/") ||
      resolvedCover.startsWith(assetRoot)
    ) {
      return resolvedCover;
    }
    return `${musicBasePath}covers/${resolvedCover}`;
  }

  function saveMusicState() {
    if (!musicAudio) {
      return;
    }

    const track = getCurrentTrack();
    const state = {
      trackUrl: track ? track.url : localStorage.getItem(musicTrackStorageKey) || "",
      trackFile: track ? getBasename(track.url).toLowerCase() : "",
      currentTime: Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0,
      wasPlaying: !musicAudio.paused,
      volume: Number.isFinite(musicDesiredVolume)
        ? Math.min(1, Math.max(0, musicDesiredVolume))
        : (Number.isFinite(musicAudio.volume) ? musicAudio.volume : 1),
      muted: Boolean(musicAudio.muted),
      updatedAt: Date.now()
    };

    try {
      sessionStorage.setItem(musicStateStorageKey, JSON.stringify(state));
    } catch (_) {
      // ignore storage failures
    }
  }

  function readSavedMusicState() {
    try {
      const raw = sessionStorage.getItem(musicStateStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function clampVolume(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
  }

  function stopMusicVolumeFade() {
    if (musicFadeRaf) {
      cancelAnimationFrame(musicFadeRaf);
      musicFadeRaf = 0;
    }
  }

  function getDesiredMusicVolume() {
    return clampVolume(musicDesiredVolume);
  }

  function fadeMusicVolume(from, to, durationMs, onDone) {
    if (!musicAudio) {
      if (typeof onDone === "function") {
        onDone();
      }
      return;
    }

    stopMusicVolumeFade();
    const startVolume = clampVolume(from);
    const targetVolume = clampVolume(to);
    const duration = Math.max(0, Number(durationMs) || 0);

    if (
      reduceMotionQuery.matches ||
      duration === 0 ||
      Math.abs(targetVolume - startVolume) < 0.003
    ) {
      musicAudio.volume = targetVolume;
      if (typeof onDone === "function") {
        onDone();
      }
      return;
    }

    const startTime = performance.now();
    musicAudio.volume = startVolume;

    const step = (now) => {
      if (!musicAudio) {
        stopMusicVolumeFade();
        return;
      }
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - ((1 - progress) * (1 - progress) * (1 - progress));
      musicAudio.volume = startVolume + (targetVolume - startVolume) * eased;
      if (progress >= 1) {
        musicFadeRaf = 0;
        musicAudio.volume = targetVolume;
        if (typeof onDone === "function") {
          onDone();
        }
        return;
      }
      musicFadeRaf = requestAnimationFrame(step);
    };

    musicFadeRaf = requestAnimationFrame(step);
  }

  async function playMusicWithFadeIn() {
    if (!musicAudio) {
      return false;
    }

    const targetVolume = getDesiredMusicVolume();
    const canFadeIn = !musicAudio.muted && targetVolume > 0.001 && !reduceMotionQuery.matches;

    stopMusicVolumeFade();
    musicAudio.volume = canFadeIn ? 0 : targetVolume;

    try {
      await musicAudio.play();
    } catch (_) {
      musicAudio.volume = targetVolume;
      return false;
    }

    if (canFadeIn) {
      fadeMusicVolume(0, targetVolume, musicFadeInMs);
    }
    updatePlayButtonLabel();
    return true;
  }

  function pauseMusicWithFadeOut() {
    if (!musicAudio || musicAudio.paused) {
      return;
    }

    const targetVolume = getDesiredMusicVolume();
    const currentVolume = clampVolume(musicAudio.volume);
    const canFadeOut = !musicAudio.muted && currentVolume > 0.001 && !reduceMotionQuery.matches;

    if (!canFadeOut) {
      musicAudio.pause();
      musicAudio.volume = targetVolume;
      updatePlayButtonLabel();
      return;
    }

    fadeMusicVolume(currentVolume, 0, musicFadeOutMs, () => {
      if (!musicAudio) {
        return;
      }
      musicAudio.pause();
      musicAudio.volume = targetVolume;
      updatePlayButtonLabel();
    });
  }

  document.addEventListener("site:music-pause-fadeout", () => {
    pauseMusicWithFadeOut();
  });

  function resolveAssetPath(pathOrUrl) {
    if (!pathOrUrl || typeof pathOrUrl !== "string") {
      return "";
    }
    if (isNestedPage && pathOrUrl.startsWith("assets/")) {
      return `../${pathOrUrl}`;
    }
    return pathOrUrl;
  }

  function filenameWithoutExtension(pathOrUrl) {
    const base = getBasename(pathOrUrl);
    return base.replace(/\.[a-z0-9]+$/i, "").trim();
  }

  function slugifyCoverName(name) {
    const normalized = (name || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || "emoji-track";
  }

  function buildCoverCandidates(trackUrl, explicitCover) {
    const extList = ["webp", "jpg", "jpeg", "png", "svg"];
    const rawName = filenameWithoutExtension(trackUrl);
    const slug = slugifyCoverName(rawName);
    const candidates = [];

    if (explicitCover) {
      candidates.push(normalizeCoverUrl(explicitCover));
    }

    extList.forEach((ext) => {
      candidates.push(`${musicBasePath}covers/${rawName}.${ext}`);
      candidates.push(`${musicBasePath}covers/${slug}.${ext}`);
    });

    return [...new Set(candidates.map((entry) => encodeTrackUrl(entry)))];
  }

  function applyCoverToImage(img, track) {
    if (!img) {
      return;
    }

    const queue = [];
    if (track && track.cover) {
      queue.push(track.cover);
    }
    if (track && Array.isArray(track.coverCandidates)) {
      queue.push(...track.coverCandidates);
    }
    queue.push(defaultCoverSrc);

    const uniqueQueue = [...new Set(queue.filter(Boolean))];
    let cursor = 0;

    function setNext() {
      const nextSrc = uniqueQueue[cursor] || fallbackCoverSrc;
      cursor += 1;
      img.src = nextSrc;
    }

    img.onerror = () => {
      if (cursor < uniqueQueue.length) {
        setNext();
        return;
      }
      img.onerror = null;
      img.src = fallbackCoverSrc;
    };

    setNext();
  }

  async function detectTracksFromDirectory() {
    try {
      const response = await fetch(musicBasePath, { cache: "no-store" });
      if (!response.ok) {
        return [];
      }
      const text = await response.text();
      const matches = [...text.matchAll(/href=["']([^"']+\.mp3)["']/gi)];
      const urls = [...new Set(matches.map((m) => m[1]))]
        .filter((href) => !href.startsWith("http") || href.includes(window.location.host))
        .map((href) => (href.startsWith("http") ? new URL(href).pathname.split("/").slice(-2).join("/") : href))
        .map((href) => (href.startsWith(musicBasePath) ? href : `${musicBasePath}${href.replace(/^\.?\/?/, "")}`));
      return urls;
    } catch (_) {
      return [];
    }
  }

  async function loadPlaylist() {
    const sourceEl = musicAudio ? musicAudio.querySelector("source") : null;
    const defaultTrack = sourceEl ? sourceEl.getAttribute("src") : "";

    let rawTracks = [];
    let playlistMeta = [];
    let playlistJsonMeta = [];
    const playlistReady = window.SITE_MUSIC_PLAYLIST_READY;
    if (playlistReady && typeof playlistReady.then === "function") {
      try {
        await playlistReady;
      } catch (_) {
        // ignore readiness errors and continue with fallbacks
      }
    }

    const inlinePlaylist = window.SITE_MUSIC_PLAYLIST;

    if (inlinePlaylist) {
      if (Array.isArray(inlinePlaylist)) {
        playlistMeta = inlinePlaylist;
      } else if (inlinePlaylist && Array.isArray(inlinePlaylist.tracks)) {
        playlistMeta = inlinePlaylist.tracks;
      }
    }

    try {
      const response = await fetch(`${musicBasePath}playlist.json`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload)) {
          playlistJsonMeta = payload;
        } else if (payload && Array.isArray(payload.tracks)) {
          playlistJsonMeta = payload.tracks;
        }
      }
    } catch (_) {
      // no playlist file, fallback below
    }

    if (!playlistMeta.length && playlistJsonMeta.length) {
      playlistMeta = playlistJsonMeta;
    }

    const detectedTracks = await detectTracksFromDirectory();

    if (detectedTracks.length) {
      // Build playlist from real files found in assets/Musics.
      const metaSource = playlistJsonMeta.length ? playlistJsonMeta : playlistMeta;
      const metaByFile = new Map(
        metaSource
          .map((entry, idx) => normalizeTrack(entry, idx))
          .filter(Boolean)
          .map((entry) => [getBasename(entry.url).toLowerCase(), entry])
      );

      rawTracks = detectedTracks.map((url, idx) => {
        const base = getBasename(url).toLowerCase();
        const meta = metaByFile.get(base);
        return meta
          ? {
              file: url,
              title: meta.title,
              artist: meta.artist,
              cover: meta.cover
            }
          : url;
      });
    } else if (playlistJsonMeta.length || playlistMeta.length) {
      // Fallback when directory listing is unavailable.
      rawTracks = playlistJsonMeta.length ? playlistJsonMeta : playlistMeta;
    }

    if (!rawTracks.length && defaultTrack) {
      rawTracks = [defaultTrack];
    }

    playlist.length = 0;
    rawTracks
      .map((track, idx) => normalizeTrack(track, idx))
      .filter(Boolean)
      .forEach((track) => playlist.push(track));

    if (!playlist.length) {
      return;
    }

    const savedState = readSavedMusicState();
    const savedTrackUrl = (savedState && savedState.trackUrl) || localStorage.getItem(musicTrackStorageKey);
    const savedTrackFile = (savedState && typeof savedState.trackFile === "string")
      ? savedState.trackFile
      : (savedTrackUrl ? getBasename(savedTrackUrl).toLowerCase() : "");
    const savedIndex = playlist.findIndex((track) =>
      track.url === savedTrackUrl ||
      (savedTrackFile && getBasename(track.url).toLowerCase() === savedTrackFile)
    );
    currentTrackIndex = savedIndex >= 0 ? savedIndex : 0;

    const shouldAutoStart = localStorage.getItem(musicAutoStartStorageKey) !== "0";
    setTrack(currentTrackIndex, shouldAutoStart, "next", false);
    if (musicAudio && savedState) {
      const activeTrack = playlist[currentTrackIndex];
      const activeTrackFile = activeTrack ? getBasename(activeTrack.url).toLowerCase() : "";
      const isSameTrack =
        (savedState.trackUrl && activeTrack && savedState.trackUrl === activeTrack.url) ||
        (savedTrackFile && activeTrackFile && savedTrackFile === activeTrackFile);

      if (!isSameTrack) {
        renderQueue();
        return;
      }

      if (Number.isFinite(savedState.volume) && savedState.volume >= 0 && savedState.volume <= 1) {
        musicDesiredVolume = clampVolume(savedState.volume);
        musicAudio.volume = musicDesiredVolume;
        if (musicVolume) {
          musicVolume.value = String(musicDesiredVolume);
        }
      }
      musicAudio.muted = Boolean(savedState.muted);

      const resumeTime = Number(savedState.currentTime);
      if (Number.isFinite(resumeTime) && resumeTime > 0) {
        const applyResumeTime = () => {
          const maxTime = Number.isFinite(musicAudio.duration) && musicAudio.duration > 0
            ? Math.max(0, musicAudio.duration - 0.25)
            : resumeTime;
          musicAudio.currentTime = Math.min(resumeTime, maxTime);
          syncMusicUi();
        };

        if (musicAudio.readyState >= 1) {
          applyResumeTime();
        } else {
          musicAudio.addEventListener("loadedmetadata", applyResumeTime, { once: true });
        }
      }

      if (savedState.wasPlaying || shouldAutoStart) {
        pendingAutoplay = true;
        pendingAutoplayUrl = playlist[currentTrackIndex].requestUrl || playlist[currentTrackIndex].url;
        if (musicAudio.readyState >= 2) {
          tryPendingAutoplay();
        }
      }
    }

    renderQueue();
  }

  function updatePlayButtonLabel() {
    if (!musicPlayBtn || !musicAudio) {
      return;
    }
    const playLabel = activeTranslation.musicPlay || "Play";
    const pauseLabel = activeTranslation.musicPause || "Pause";
    if (musicPlayIcon) {
      musicPlayIcon.src = musicAudio.paused ? `${iconBasePath}play.webp` : `${iconBasePath}pause.webp`;
    }
    musicPlayBtn.setAttribute("aria-label", musicAudio.paused ? playLabel : pauseLabel);
    musicPlayBtn.title = musicAudio.paused ? playLabel : pauseLabel;
  }

  function updateMuteButtonLabel() {
    if (!musicMuteBtn || !musicAudio) {
      return;
    }
    const muteLabel = activeTranslation.musicMute || "Mute";
    const unmuteLabel = activeTranslation.musicUnmute || "Unmute";
    if (musicMuteIcon) {
      musicMuteIcon.src = musicAudio.muted ? `${iconBasePath}mute.webp` : `${iconBasePath}volume.webp`;
    }
    musicMuteBtn.setAttribute("aria-label", musicAudio.muted ? unmuteLabel : muteLabel);
    musicMuteBtn.title = musicAudio.muted ? unmuteLabel : muteLabel;
  }

  function syncMusicUi() {
    if (!musicAudio) {
      return;
    }

    const duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 0;
    const current = Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;

    if (musicDuration) {
      musicDuration.textContent = formatTime(duration);
    }
    if (musicCurrentTime) {
      musicCurrentTime.textContent = formatTime(current);
    }
    if (musicProgress) {
      musicProgress.max = duration > 0 ? String(duration) : "100";
      musicProgress.value = duration > 0 ? String(current) : "0";
    }
    updatePlayButtonLabel();
    updateMuteButtonLabel();
  }

  function animateNowPlayingChange(direction = "next") {
    if (!musicNow || reduceMotionQuery.matches) {
      return;
    }

    musicNow.classList.remove("is-track-transition");
    musicNow.classList.remove("is-track-next");
    musicNow.classList.remove("is-track-prev");
    void musicNow.offsetWidth;
    musicNow.classList.add("is-track-transition");
    musicNow.classList.add(direction === "prev" ? "is-track-prev" : "is-track-next");
  }

  function tryPendingAutoplay() {
    if (!musicAudio || !pendingAutoplay) {
      return;
    }

    playMusicWithFadeIn().then((played) => {
      if (played) {
        pendingAutoplay = false;
        pendingAutoplayUrl = "";
        updatePlayButtonLabel();
        return;
      }
      const wasMuted = musicAudio.muted;
      musicAudio.muted = true;
      playMusicWithFadeIn().then((playedMuted) => {
        if (!playedMuted) {
          musicAudio.muted = wasMuted;
          return;
        }
        pendingAutoplay = false;
        pendingAutoplayUrl = "";
        if (!wasMuted) {
          setTimeout(() => {
            if (!musicAudio || musicAudio.paused) {
              return;
            }
            musicAudio.muted = false;
            const targetVolume = getDesiredMusicVolume();
            if (targetVolume > 0.001 && !reduceMotionQuery.matches) {
              musicAudio.volume = 0;
              fadeMusicVolume(0, targetVolume, musicFadeInMs);
            } else {
              musicAudio.volume = targetVolume;
            }
            updateMuteButtonLabel();
          }, 140);
        }
        updatePlayButtonLabel();
      });
    });
  }

  function getCurrentTrack() {
    return playlist[currentTrackIndex] || null;
  }

  function setTrack(index, autoplay = false, direction = "next", animate = true) {
    if (!musicAudio || !playlist.length) {
      return;
    }

    const safeIndex = (index + playlist.length) % playlist.length;
    currentTrackIndex = safeIndex;
    const track = playlist[safeIndex];

    const source = musicAudio.querySelector("source");
    const requestUrl = track.requestUrl || track.url;
    if (source) {
      source.src = requestUrl;
    } else {
      musicAudio.src = requestUrl;
    }

    pendingAutoplay = autoplay;
    pendingAutoplayUrl = requestUrl;
    musicAudio.load();
    if (nowPlayingSwapTimer) {
      clearTimeout(nowPlayingSwapTimer);
      nowPlayingSwapTimer = null;
    }

    if (animate && musicNow && !reduceMotionQuery.matches) {
      animateNowPlayingChange(direction);
      nowPlayingSwapTimer = setTimeout(() => {
        syncNowPlayingFromTrack(track);
        nowPlayingSwapTimer = null;
      }, 150);
    } else {
      syncNowPlayingFromTrack(track);
    }

    localStorage.setItem(musicTrackStorageKey, track.url);
    renderQueue();

    if (autoplay) {
      if (musicAudio.readyState >= 2) {
        tryPendingAutoplay();
      } else {
        updatePlayButtonLabel();
      }
    }
  }

  function goToNextTrack(autoplay = true) {
    if (!playlist.length) {
      return;
    }
    setTrack(currentTrackIndex + 1, autoplay, "next", true);
  }

  function goToNextPlayableTrack(autoplay = true) {
    if (!playlist.length) {
      return;
    }
    for (let step = 1; step <= playlist.length; step += 1) {
      const idx = (currentTrackIndex + step) % playlist.length;
      const candidate = playlist[idx];
      if (!candidate || brokenTrackUrls.has(candidate.url)) {
        continue;
      }
      setTrack(idx, autoplay, "next", true);
      return;
    }
  }

  function goToPrevTrack() {
    if (!playlist.length) {
      return;
    }
    if (musicAudio && musicAudio.currentTime > 3) {
      musicAudio.currentTime = 0;
      syncMusicUi();
      return;
    }
    setTrack(currentTrackIndex - 1, true, "prev", true);
  }

  function shufflePlaylist() {
    if (playlist.length < 2) {
      return;
    }

    const currentTrack = getCurrentTrack();
    for (let i = playlist.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }

    currentTrackIndex = Math.max(0, playlist.findIndex((track) => track === currentTrack));
    renderQueue();
  }

  function renderQueue() {
    if (!musicQueueList) {
      return;
    }

    musicQueueList.innerHTML = "";

    if (!playlist.length) {
      const empty = document.createElement("p");
      empty.className = "music-queue-artist";
      empty.textContent = "No tracks found";
      musicQueueList.appendChild(empty);
      return;
    }

    playlist.forEach((track, idx) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `music-queue-item${idx === currentTrackIndex ? " active" : ""}`;

      const cover = document.createElement("img");
      cover.className = "music-queue-cover";
      cover.alt = track.title;
      applyCoverToImage(cover, track);

      const meta = document.createElement("div");
      const name = document.createElement("p");
      name.className = "music-queue-name";
      name.textContent = track.title;
      const artist = document.createElement("p");
      artist.className = "music-queue-artist";
      artist.textContent = track.artist || "";

      meta.appendChild(name);
      meta.appendChild(artist);
      item.appendChild(cover);
      item.appendChild(meta);

      item.addEventListener("click", () => {
        item.classList.remove("is-selecting");
        void item.offsetWidth;
        item.classList.add("is-selecting");
        setTimeout(() => {
          item.classList.remove("is-selecting");
        }, 260);
        const direction = idx < currentTrackIndex ? "prev" : "next";
        setTrack(idx, true, direction, true);
      });

      musicQueueList.appendChild(item);
    });
  }

  function syncNowPlayingFromTrack(track) {
    if (!track) {
      return;
    }
    if (musicTrackTitle) {
      musicTrackTitle.textContent = track.title || filenameToTitle(track.url);
    }
    if (musicTrackComposer) {
      musicTrackComposer.textContent = track.artist || (activeTranslation.musicTrackComposer || "");
    }
    if (musicCover) {
      applyCoverToImage(musicCover, track);
    }
  }

  function typeBrandTitle(targetSuffix, force = false) {
    if (!brandTitle) {
      return;
    }

    if (reduceMotionQuery.matches) {
      brandTitle.textContent = `${brandPrefix}${targetSuffix}`;
      currentBrandSuffix = targetSuffix;
      return;
    }

    if (brandTypeTimer) {
      clearTimeout(brandTypeTimer);
    }

    if (!force && targetSuffix === currentBrandSuffix) {
      brandTitle.textContent = `${brandPrefix}${targetSuffix}`;
      return;
    }

    let editable = currentBrandSuffix;
    let writeIndex = 0;

    function eraseStep() {
      brandTitle.textContent = `${brandPrefix}${editable}`;
      if (editable.length > 0) {
        editable = editable.slice(0, -1);
        brandTypeTimer = setTimeout(eraseStep, 24);
        return;
      }

      writeStep();
    }

    function writeStep() {
      writeIndex += 1;
      brandTitle.textContent = `${brandPrefix}${targetSuffix.slice(0, writeIndex)}`;
      if (writeIndex < targetSuffix.length) {
        brandTypeTimer = setTimeout(writeStep, 34);
        return;
      }

      currentBrandSuffix = targetSuffix;
    }

    eraseStep();
  }

  function typeBrandTitleWriteOnly(targetSuffix) {
    if (!brandTitle) {
      return;
    }

    if (reduceMotionQuery.matches) {
      brandTitle.textContent = `${brandPrefix}${targetSuffix}`;
      currentBrandSuffix = targetSuffix;
      return;
    }

    if (brandTypeTimer) {
      clearTimeout(brandTypeTimer);
    }

    brandTitle.textContent = brandPrefix;
    currentBrandSuffix = "";
    let writeIndex = 0;

    function writeStep() {
      writeIndex += 1;
      brandTitle.textContent = `${brandPrefix}${targetSuffix.slice(0, writeIndex)}`;
      if (writeIndex < targetSuffix.length) {
        brandTypeTimer = setTimeout(writeStep, 34);
        return;
      }
      currentBrandSuffix = targetSuffix;
    }

    brandTypeTimer = setTimeout(writeStep, 30);
  }

  function typeTabTitle(targetTitle, force = false) {
    const currentTitle = document.title || "";

    if (reduceMotionQuery.matches) {
      document.title = targetTitle;
      return;
    }

    if (tabTitleTimer) {
      clearTimeout(tabTitleTimer);
    }

    if (!force && targetTitle === currentTitle) {
      document.title = targetTitle;
      return;
    }
    let writeIndex = 0;
    document.title = "";

    function writeStep() {
      writeIndex += 1;
      document.title = targetTitle.slice(0, writeIndex);
      if (writeIndex < targetTitle.length) {
        tabTitleTimer = setTimeout(writeStep, 500);
      }
    }

    tabTitleTimer = setTimeout(writeStep, 500);
  }

  function typeTabTitleWriteOnly(targetTitle) {
    if (reduceMotionQuery.matches) {
      document.title = targetTitle;
      return;
    }

    if (tabTitleTimer) {
      clearTimeout(tabTitleTimer);
    }

    document.title = "";
    let writeIndex = 0;

    function writeStep() {
      writeIndex += 1;
      document.title = targetTitle.slice(0, writeIndex);
      if (writeIndex < targetTitle.length) {
        tabTitleTimer = setTimeout(writeStep, 500);
      }
    }

    tabTitleTimer = setTimeout(writeStep, 500);
  }

  function applyLanguage(langChoice, animate = false) {
    const effectiveLang = langChoice === "system" ? getSystemLanguage() : langChoice;
    const t = translations[effectiveLang] || translations.fr || {};
    activeTranslation = t;

    const map = [
      ["#nav-home", t.info],
      ["#nav-res", t.res],
      ["#nav-credit", t.credit],
      ["#theme-label", t.settingsTheme],
      ["#lang-label", t.settingsLanguage],
      ["#music-title", t.musicTitle],
      ["#music-queue-title", t.musicUpNext],
      ["#theme-system-option", t.themeSystem],
      ["#theme-dark-option", t.themeDark],
      ["#theme-light-option", t.themeLight],
      ["#theme-starnight-option", t.themeStarnight],
      ["#lang-system-option", t.langSystem],
      ["#lang-fr-option", t.langFr],
      ["#lang-en-option", t.langEn],
      ["#dev-banner-text", t.devBanner],
      ["#home-title", t.title],
      ["#home-subtitle", t.subtitle],
      ["#home-p1", t.p1],
      ["#home-p2", t.p2],
      ["#resources-title", t.rTitle],
      ["#resources-main-title", t.resourcesMainTitle],
      ["#resources-main-subtitle", t.resourcesMainSubtitle],
      ["#resources-filter-all", t.resourcesFilterAll],
      ["#resources-filter-wii", t.resourcesFilterWii],
      ["#resources-filter-wiiu", t.resourcesFilterWiiU],
      ["#resources-filter-other", t.resourcesFilterOther],
      ["#resources-catalog-title", t.resourcesCatalogTitle],
      ["#resources-empty", t.resourcesEmpty],
      ["#placeholder-title", t.placeholderTitle],
      ["#placeholder-text", t.placeholderText],
      ["#placeholder-back", t.placeholderBack],
      ["#resources-card1-badge", t.resourcesCard1Badge],
      ["#resources-card1-title", t.resourcesCard1Title],
      ["#resources-card1-by", t.resourcesCard1By],
      ["#resources-card1-desc", t.resourcesCard1Desc],
      ["#resources-card2-badge", t.resourcesCard2Badge],
      ["#resources-card2-title", t.resourcesCard2Title],
      ["#resources-card2-by", t.resourcesCard2By],
      ["#resources-card2-desc", t.resourcesCard2Desc],
      ["#resources-card3-badge", t.resourcesCard3Badge],
      ["#resources-card3-title", t.resourcesCard3Title],
      ["#resources-card3-by", t.resourcesCard3By],
      ["#resources-card3-desc", t.resourcesCard3Desc],
      ["#ninconvert-title", t.ninconvertTitle],
      ["#ninconvert-subtitle", t.ninconvertSubtitle],
      ["#ninconvert-meta", t.ninconvertMeta],
      ["#nin-file-label", t.ninFileLabel],
      ["#nin-dropzone-title", t.ninDropzoneTitle],
      ["#nin-dropzone-sub", t.ninDropzoneSub],
      ["#nin-format-label", t.ninFormatLabel],
      ["#nin-loop-toggle-label", t.ninLoopToggleLabel],
      ["#nin-loop-start-label", t.ninLoopStartLabel],
      ["#nin-loop-end-label", t.ninLoopEndLabel],
      ["#nin-source-preview-label", t.ninSourcePreviewLabel],
      ["#nin-set-loop-start", t.ninSetLoopStart],
      ["#nin-set-loop-end", t.ninSetLoopEnd],
      ["#nin-convert-btn", t.ninConvertButton],
      ["#nin-download", t.ninDownload],
      ["#nin-loop-preview-btn", t.ninLoopPreviewOff],
      ["#nin-api-label", t.ninApiLabel],
      ["#nin-status", t.ninStatusIdle],
      ["#ninconvert-note", t.ninconvertNote],
      ["#nin-oss-title", t.ninOssTitle],
      ["#nin-oss-subtitle", t.ninOssSubtitle],
      ["#nin-oss-used-now", t.ninOssUsedNow],
      ["#nin-oss-ref-link", t.ninOssRefLink],
      ["#nin-oss-needed-backend", t.ninOssNeededBackend],
      ["#resources-link-g", t.g],
      ["#resources-link-d", t.d],
      ["#resources-link-m", t.m],
      ["#credit-title", t.cTitle],
      ["#credit-p1", t.c1],
      ["#credit-p2", t.c2]
    ];

    map.forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (!node || typeof value !== "string") {
        return;
      }

      if (animate) {
        animateReplaceText(node, value);
      } else {
        node.textContent = value;
      }
    });

    if (settingsBtn && t.settingsAria) {
      settingsBtn.setAttribute("aria-label", t.settingsAria);
    }
    if (musicBtn && t.musicAria) {
      musicBtn.setAttribute("aria-label", t.musicAria);
    }
    if (musicPrevBtn && t.musicPrev) {
      musicPrevBtn.setAttribute("aria-label", t.musicPrev);
      musicPrevBtn.title = t.musicPrev;
    }
    if (musicNextBtn && t.musicNext) {
      musicNextBtn.setAttribute("aria-label", t.musicNext);
      musicNextBtn.title = t.musicNext;
    }
    if (musicQueueBtn && t.musicQueue) {
      musicQueueBtn.setAttribute("aria-label", t.musicQueue);
      musicQueueBtn.title = t.musicQueue;
    }
    if (musicShuffleBtn && t.musicShuffle) {
      musicShuffleBtn.setAttribute("aria-label", t.musicShuffle);
      musicShuffleBtn.title = t.musicShuffle;
    }
    if (musicProgress && t.musicProgressAria) {
      musicProgress.setAttribute("aria-label", t.musicProgressAria);
    }
    if (musicVolume && t.musicVolumeAria) {
      musicVolume.setAttribute("aria-label", t.musicVolumeAria);
    }
    const resourcesSearch = document.querySelector("#resources-search");
    if (resourcesSearch && t.resourcesSearchPlaceholder) {
      resourcesSearch.setAttribute("placeholder", t.resourcesSearchPlaceholder);
      resourcesSearch.setAttribute("aria-label", t.resourcesSearchPlaceholder);
    }

    updatePlayButtonLabel();
    updateMuteButtonLabel();

    document.documentElement.lang = effectiveLang;
    localStorage.setItem("site-lang", langChoice);
    document.dispatchEvent(new CustomEvent("site:language-updated", {
      detail: { langChoice, effectiveLang, translation: t }
    }));
  }

  function openSettingsPanel() {
    if (!settingsPanel || !settingsBtn) {
      return;
    }

    settingsPanel.classList.add("is-open");
    settingsPanel.setAttribute("aria-hidden", "false");
    settingsBtn.setAttribute("aria-expanded", "true");
  }

  function closeSettingsPanel() {
    if (!settingsPanel || !settingsBtn) {
      return;
    }

    settingsPanel.classList.remove("is-open");
    settingsPanel.setAttribute("aria-hidden", "true");
    settingsBtn.setAttribute("aria-expanded", "false");
  }

  function openMusicPanel() {
    if (!musicPanel || !musicBtn) {
      return;
    }

    musicPanel.classList.add("is-open");
    musicPanel.setAttribute("aria-hidden", "false");
    musicBtn.setAttribute("aria-expanded", "true");
  }

  function closeMusicPanel() {
    if (!musicPanel || !musicBtn) {
      return;
    }

    musicPanel.classList.remove("is-open");
    musicPanel.setAttribute("aria-hidden", "true");
    musicBtn.setAttribute("aria-expanded", "false");
    closeQueuePanel();
  }

  function openQueuePanel() {
    if (!musicQueuePanel || !musicQueueBtn) {
      return;
    }
    musicQueuePanel.classList.add("is-open");
    musicQueuePanel.setAttribute("aria-hidden", "false");
    musicQueueBtn.setAttribute("aria-expanded", "true");
  }

  function closeQueuePanel() {
    if (!musicQueuePanel || !musicQueueBtn) {
      return;
    }
    musicQueuePanel.classList.remove("is-open");
    musicQueuePanel.setAttribute("aria-hidden", "true");
    musicQueueBtn.setAttribute("aria-expanded", "false");
  }

  if (settingsBtn && settingsPanel && musicBtn && musicPanel) {
    settingsBtn.addEventListener("click", () => {
      const isOpen = settingsPanel.classList.contains("is-open");
      if (isOpen) {
        closeSettingsPanel();
      } else {
        closeMusicPanel();
        openSettingsPanel();
      }
    });

    musicBtn.addEventListener("click", () => {
      const isOpen = musicPanel.classList.contains("is-open");
      if (isOpen) {
        closeMusicPanel();
      } else {
        closeSettingsPanel();
        openMusicPanel();
      }
    });

    if (musicQueueBtn) {
      musicQueueBtn.addEventListener("click", () => {
        if (musicQueuePanel && musicQueuePanel.classList.contains("is-open")) {
          closeQueuePanel();
        } else {
          openQueuePanel();
        }
      });
    }

    if (musicShuffleBtn) {
      musicShuffleBtn.addEventListener("click", () => {
        shufflePlaylist();
      });
    }

    document.addEventListener("click", (event) => {
      if (!settingsPanel.contains(event.target) && !settingsBtn.contains(event.target)) {
        closeSettingsPanel();
      }
      if (!musicPanel.contains(event.target) && !musicBtn.contains(event.target)) {
        closeMusicPanel();
      }
    });

    settingsPanel.addEventListener("mouseenter", () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    });

    settingsPanel.addEventListener("mouseleave", () => {
      closeTimer = setTimeout(closeSettingsPanel, 120);
    });

    musicPanel.addEventListener("mouseenter", () => {
      if (musicCloseTimer) {
        clearTimeout(musicCloseTimer);
      }
    });

    musicPanel.addEventListener("mouseleave", () => {
      musicCloseTimer = setTimeout(closeMusicPanel, 120);
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  }

  if (langSelect) {
    langSelect.addEventListener("change", () => applyLanguage(langSelect.value, true));
  }

  if (typeof window.initResourcesFilters === "function") {
    window.initResourcesFilters();
  }

  document.querySelectorAll(".menu a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetPage = getPageFromHref(link.getAttribute("href"));
      if (!targetPage) {
        return;
      }

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        link.target === "_blank"
      ) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href) {
        event.preventDefault();
        return;
      }
      if (targetPage === pageName) {
        return;
      }

      sessionStorage.setItem(pendingFromStorageKey, pageName);
      sessionStorage.setItem(pendingTargetStorageKey, targetPage);
      saveMusicState();

      if (reduceMotionQuery.matches) {
        return;
      }

      event.preventDefault();
      animatedSections.forEach((node) => {
        node.classList.add("is-section-exit");
      });
      setTimeout(() => {
        window.location.href = href;
      }, 380);
    });
  });

  if (musicAudio) {
    musicAudio.addEventListener("loadedmetadata", () => {
      syncMusicUi();
      tryPendingAutoplay();
    });
    musicAudio.addEventListener("canplay", tryPendingAutoplay);
    musicAudio.addEventListener("durationchange", syncMusicUi);
    musicAudio.addEventListener("timeupdate", syncMusicUi);
    musicAudio.addEventListener("loadeddata", () => {
      const track = getCurrentTrack();
      if (track) {
        brokenTrackUrls.delete(track.url);
      }
      tryPendingAutoplay();
    });
    musicAudio.addEventListener("play", updatePlayButtonLabel);
    musicAudio.addEventListener("pause", updatePlayButtonLabel);
    musicAudio.addEventListener("ended", () => {
      goToNextTrack(true);
      updatePlayButtonLabel();
    });
    musicAudio.addEventListener("error", () => {
      const track = getCurrentTrack();
      if (track) {
        brokenTrackUrls.add(track.url);
      }
      goToNextPlayableTrack(true);
      syncMusicUi();
    });
  }

  if (musicProgress && musicAudio) {
    musicProgress.addEventListener("input", () => {
      const target = Number(musicProgress.value);
      if (Number.isFinite(target)) {
        musicAudio.currentTime = target;
        syncMusicUi();
      }
    });
  }

  if (musicPlayBtn && musicAudio) {
    musicPlayBtn.addEventListener("click", async () => {
      if (musicAudio.paused) {
        await playMusicWithFadeIn();
      } else {
        pauseMusicWithFadeOut();
      }
      updatePlayButtonLabel();
    });
  }

  if (musicPrevBtn) {
    musicPrevBtn.addEventListener("click", () => {
      goToPrevTrack();
    });
  }

  if (musicNextBtn) {
    musicNextBtn.addEventListener("click", () => {
      goToNextTrack(true);
    });
  }

  if (musicMuteBtn && musicAudio) {
    musicMuteBtn.addEventListener("click", () => {
      musicAudio.muted = !musicAudio.muted;
      localStorage.setItem(musicMuteStorageKey, musicAudio.muted ? "1" : "0");
      updateMuteButtonLabel();
    });
  }

  if (musicVolume && musicAudio) {
    musicVolume.addEventListener("input", () => {
      const value = Number(musicVolume.value);
      if (Number.isFinite(value)) {
        musicDesiredVolume = clampVolume(value);
        stopMusicVolumeFade();
        musicAudio.volume = musicDesiredVolume;
        if (value > 0 && musicAudio.muted) {
          musicAudio.muted = false;
        }
        localStorage.setItem(musicVolumeStorageKey, String(musicDesiredVolume));
        localStorage.setItem(musicMuteStorageKey, musicAudio.muted ? "1" : "0");
        updateMuteButtonLabel();
      }
    });
  }

  const savedTheme = localStorage.getItem("site-theme") || "system";
  const savedLang = localStorage.getItem("site-lang") || "system";

  if (themeSelect) {
    themeSelect.value = ["system", "dark", "light", "starnight"].includes(savedTheme) ? savedTheme : "system";
    applyTheme(themeSelect.value);
  }

  window.addEventListener("pagehide", saveMusicState);
  window.addEventListener("beforeunload", saveMusicState);

  if (langSelect) {
    langSelect.value = ["system", "fr", "en"].includes(savedLang) ? savedLang : "system";
    applyLanguage(langSelect.value, false);
  }

  if (musicAudio) {
    if (localStorage.getItem(musicAutoStartStorageKey) === null) {
      localStorage.setItem(musicAutoStartStorageKey, "1");
    }

    const savedVolume = Number(localStorage.getItem(musicVolumeStorageKey));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      musicDesiredVolume = clampVolume(savedVolume);
      musicAudio.volume = musicDesiredVolume;
      if (musicVolume) {
        musicVolume.value = String(musicDesiredVolume);
      }
    } else {
      musicDesiredVolume = clampVolume(musicAudio.volume);
    }
    musicAudio.muted = localStorage.getItem(musicMuteStorageKey) === "1";
    updateMuteButtonLabel();
  }

  syncMusicUi();

  loadPlaylist().then(() => {
    syncMusicUi();
    renderQueue();
  });

  // Some browsers block autoplay until first user interaction.
  const unlockAutoplay = () => {
    tryPendingAutoplay();
    if (!pendingAutoplay) {
      document.removeEventListener("pointerdown", unlockAutoplay);
      document.removeEventListener("keydown", unlockAutoplay);
    }
  };
  document.addEventListener("pointerdown", unlockAutoplay, { passive: true });
  document.addEventListener("keydown", unlockAutoplay);

  const targetBrandSuffix = titleByPage[pageName] || "Website";
  const targetTabTitle = `${brandPrefix}${targetBrandSuffix}`;
  const previousTabTitle = previousPageName ? `${brandPrefix}${titleByPage[previousPageName] || ""}` : "";
  const reloadNavigation = isPageReload();
  const shouldAnimateBrand = !reduceMotionQuery.matches && !reloadNavigation;

  if (brandTitle && shouldAnimateBrand) {
    const previousBrandSuffix = previousPageName ? (titleByPage[previousPageName] || "") : "";
    if (previousBrandSuffix && previousBrandSuffix !== targetBrandSuffix) {
      brandTitle.textContent = `${brandPrefix}${previousBrandSuffix}`;
      currentBrandSuffix = previousBrandSuffix;
    } else {
      brandTitle.textContent = brandPrefix;
      currentBrandSuffix = "";
    }
    if (previousTabTitle && previousTabTitle !== targetTabTitle) {
      document.title = previousTabTitle;
    }
    setTimeout(() => {
      typeBrandTitle(targetBrandSuffix, true);
      typeTabTitle(targetTabTitle, true);
    }, 1000);
  } else {
    if (reloadNavigation) {
      typeBrandTitleWriteOnly(targetBrandSuffix);
      typeTabTitleWriteOnly(targetTabTitle);
    } else {
      typeBrandTitle(targetBrandSuffix, true);
      typeTabTitle(targetTabTitle, true);
    }
  }
  sessionStorage.removeItem(pendingFromStorageKey);
  sessionStorage.removeItem(pendingTargetStorageKey);
  sessionStorage.setItem(lastPageStorageKey, pageName);

  systemThemeQuery.addEventListener("change", () => {
    const selectedTheme = localStorage.getItem("site-theme") || "system";
    if (selectedTheme === "system") {
      applyTheme("system");
    }
  });

  window.addEventListener("languagechange", () => {
    const selectedLang = localStorage.getItem("site-lang") || "system";
    if (selectedLang === "system") {
      applyLanguage("system", true);
    }
  });
})();
