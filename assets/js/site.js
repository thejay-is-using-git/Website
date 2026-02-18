(() => {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const musicBtn = document.getElementById("music-btn");
  const musicPanel = document.getElementById("music-panel");
  const musicAudio = document.getElementById("music-audio");
  const musicCover = document.querySelector(".music-cover");
  const musicTrackTitle = document.getElementById("music-track-title");
  const musicTrackComposer = document.getElementById("music-track-composer");
  const musicProgress = document.getElementById("music-progress");
  const musicCurrentTime = document.getElementById("music-current-time");
  const musicDuration = document.getElementById("music-duration");
  const musicPlayBtn = document.getElementById("music-play-btn");
  const musicPrevBtn = document.getElementById("music-prev-btn");
  const musicNextBtn = document.getElementById("music-next-btn");
  const musicMuteBtn = document.getElementById("music-mute-btn");
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

  const pageName = document.body.dataset.page || "information";
  const lastPageStorageKey = "site-last-page";
  const pendingFromStorageKey = "site-pending-from";
  const pendingTargetStorageKey = "site-pending-target";
  const musicTrackStorageKey = "site-music-track";
  const musicVolumeStorageKey = "site-music-volume";
  const musicMuteStorageKey = "site-music-muted";
  const musicBasePath = "assets/Musics/";
  const fallbackCoverSrc = "assets/images/album-placeholder.svg";

  const titleByPage = {
    information: "Website",
    ressources: "Resources",
    credit: "Credit"
  };
  const pathToPage = {
    "index.html": "information",
    "resources.html": "ressources",
    "credit.html": "credit"
  };

  const defaultCoverSrc = musicCover ? musicCover.src : fallbackCoverSrc;
  const playlist = [];
  const brokenTrackUrls = new Set();
  let currentTrackIndex = 0;
  let pendingAutoplay = false;
  let pendingAutoplayUrl = "";

  function getPageFromHref(href) {
    if (!href) {
      return null;
    }

    try {
      const url = new URL(href, window.location.href);
      const filename = url.pathname.split("/").pop() || "index.html";
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

  function applyTheme(themeChoice) {
    const effectiveTheme = themeChoice === "system" ? getSystemTheme() : themeChoice;
    root.setAttribute("data-theme", effectiveTheme);
    localStorage.setItem("site-theme", themeChoice);
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

    const url = fileOrUrl.startsWith("http") || fileOrUrl.startsWith(musicBasePath) ? fileOrUrl : `${musicBasePath}${fileOrUrl}`;
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
    if (
      cover.startsWith("http") ||
      cover.startsWith("data:") ||
      cover.startsWith("/") ||
      cover.startsWith("assets/")
    ) {
      return cover;
    }
    return `${musicBasePath}covers/${cover}`;
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
    const extList = ["jpg", "jpeg", "png", "webp"];
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

    if (!playlistMeta.length) {
      try {
        const response = await fetch(`${musicBasePath}playlist.json`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (Array.isArray(payload)) {
            playlistMeta = payload;
          } else if (payload && Array.isArray(payload.tracks)) {
            playlistMeta = payload.tracks;
          }
        }
      } catch (_) {
        // no playlist file, fallback below
      }
    }

    const detectedTracks = await detectTracksFromDirectory();

    if (detectedTracks.length) {
      // Build playlist from real files found in assets/Musics.
      const metaByFile = new Map(
        playlistMeta
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
    } else if (playlistMeta.length) {
      // Fallback when directory listing is unavailable.
      rawTracks = playlistMeta;
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

    const savedTrackUrl = localStorage.getItem(musicTrackStorageKey);
    const savedIndex = playlist.findIndex((track) => track.url === savedTrackUrl);
    currentTrackIndex = savedIndex >= 0 ? savedIndex : 0;

    setTrack(currentTrackIndex, false);
    renderQueue();
  }

  function updatePlayButtonLabel() {
    if (!musicPlayBtn || !musicAudio) {
      return;
    }
    const playLabel = activeTranslation.musicPlay || "Play";
    const pauseLabel = activeTranslation.musicPause || "Pause";
    musicPlayBtn.textContent = musicAudio.paused ? "▶" : "⏸";
    musicPlayBtn.setAttribute("aria-label", musicAudio.paused ? playLabel : pauseLabel);
    musicPlayBtn.title = musicAudio.paused ? playLabel : pauseLabel;
  }

  function updateMuteButtonLabel() {
    if (!musicMuteBtn || !musicAudio) {
      return;
    }
    const muteLabel = activeTranslation.musicMute || "Mute";
    const unmuteLabel = activeTranslation.musicUnmute || "Unmute";
    musicMuteBtn.textContent = musicAudio.muted ? "🔇" : "🔊";
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

  function tryPendingAutoplay() {
    if (!musicAudio || !pendingAutoplay) {
      return;
    }

    const source = musicAudio.querySelector("source");
    const currentUrl = source ? source.getAttribute("src") : musicAudio.currentSrc;
    if (pendingAutoplayUrl && currentUrl && pendingAutoplayUrl !== currentUrl) {
      return;
    }

    musicAudio.play().then(() => {
      pendingAutoplay = false;
      pendingAutoplayUrl = "";
      updatePlayButtonLabel();
    }).catch(() => {
      // keep pending flag; next user gesture or canplay can retry
    });
  }

  function getCurrentTrack() {
    return playlist[currentTrackIndex] || null;
  }

  function pictureTagToDataUrl(picture) {
    if (!picture || !picture.data || !picture.format) {
      return null;
    }
    const bytes = picture.data;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return `data:${picture.format};base64,${base64}`;
  }

  function setTrack(index, autoplay = false) {
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
    musicAudio.dataset.metaLoaded = "0";
    musicAudio.load();

    if (musicTrackTitle) {
      musicTrackTitle.textContent = track.title || filenameToTitle(track.url);
    }
    if (musicTrackComposer) {
      musicTrackComposer.textContent = track.artist || (activeTranslation.musicTrackComposer || "");
    }
    if (musicCover) {
      applyCoverToImage(musicCover, track);
    }

    localStorage.setItem(musicTrackStorageKey, track.url);
    renderQueue();
    applyMp3Metadata();

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
    setTrack(currentTrackIndex + 1, autoplay);
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
      setTrack(idx, autoplay);
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
    setTrack(currentTrackIndex - 1, true);
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
        setTrack(idx, true);
      });

      musicQueueList.appendChild(item);
    });
  }

  function applyTagsToTrack(track, tags) {
    if (!track || !tags) {
      return;
    }

    const coverDataUrl = pictureTagToDataUrl(tags.picture);
    if (coverDataUrl) {
      track.cover = coverDataUrl;
    }
    if (tags.title) {
      track.title = tags.title;
    }
    if (tags.artist) {
      track.artist = tags.artist;
    } else if (tags.album) {
      track.artist = tags.album;
    }
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

  function readTrackMetadata(track, trackIndex) {
    if (!track || !window.jsmediatags || track.metaLoaded) {
      return;
    }

    window.jsmediatags.read(track.requestUrl || track.url, {
      onSuccess: ({ tags }) => {
        track.metaLoaded = true;
        applyTagsToTrack(track, tags);
        if (trackIndex === currentTrackIndex) {
          syncNowPlayingFromTrack(track);
        }
        renderQueue();
      },
      onError: () => {
        track.metaLoaded = true;
      }
    });
  }

  function preloadPlaylistMetadata() {
    if (!window.jsmediatags || !playlist.length) {
      return;
    }

    playlist.forEach((track, idx) => {
      if (!track.title || !track.artist || !track.cover) {
        readTrackMetadata(track, idx);
      }
    });
  }

  function applyMp3Metadata() {
    if (!musicAudio || !window.jsmediatags) {
      return;
    }
    if (musicAudio.dataset.metaLoaded === "1") {
      return;
    }

    const source = musicAudio.querySelector("source");
    const fileUrl = source ? source.getAttribute("src") : musicAudio.getAttribute("src");
    if (!fileUrl) {
      return;
    }

    window.jsmediatags.read(fileUrl, {
      onSuccess: ({ tags }) => {
        musicAudio.dataset.metaLoaded = "1";
        const currentTrack = playlist[currentTrackIndex];
        if (!currentTrack) {
          return;
        }
        applyTagsToTrack(currentTrack, tags);
        syncNowPlayingFromTrack(currentTrack);
        renderQueue();
      },
      onError: () => {
        musicAudio.dataset.metaLoaded = "1";
      }
    });
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
      ["#lang-system-option", t.langSystem],
      ["#lang-fr-option", t.langFr],
      ["#lang-en-option", t.langEn],
      ["#dev-banner-text", t.devBanner],
      ["#home-title", t.title],
      ["#home-subtitle", t.subtitle],
      ["#home-p1", t.p1],
      ["#home-p2", t.p2],
      ["#resources-title", t.rTitle],
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

    updatePlayButtonLabel();
    updateMuteButtonLabel();

    document.documentElement.lang = effectiveLang;
    localStorage.setItem("site-lang", langChoice);
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

  document.querySelectorAll(".menu a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetPage = getPageFromHref(link.getAttribute("href"));
      if (!targetPage) {
        return;
      }

      sessionStorage.setItem(pendingFromStorageKey, pageName);
      sessionStorage.setItem(pendingTargetStorageKey, targetPage);

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
      if (!href || targetPage === pageName || reduceMotionQuery.matches) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("is-page-exit");
      setTimeout(() => {
        window.location.href = href;
      }, 220);
    });
  });

  if (musicAudio) {
    musicAudio.addEventListener("loadedmetadata", syncMusicUi);
    musicAudio.addEventListener("canplay", tryPendingAutoplay);
    musicAudio.addEventListener("durationchange", syncMusicUi);
    musicAudio.addEventListener("timeupdate", syncMusicUi);
    musicAudio.addEventListener("loadeddata", () => {
      const track = getCurrentTrack();
      if (track) {
        brokenTrackUrls.delete(track.url);
      }
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
      try {
        if (musicAudio.paused) {
          await musicAudio.play();
        } else {
          musicAudio.pause();
        }
      } catch (_) {
        // ignore autoplay / play promise errors
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
        musicAudio.volume = value;
        if (value > 0 && musicAudio.muted) {
          musicAudio.muted = false;
        }
        localStorage.setItem(musicVolumeStorageKey, String(value));
        localStorage.setItem(musicMuteStorageKey, musicAudio.muted ? "1" : "0");
        updateMuteButtonLabel();
      }
    });
  }

  const savedTheme = localStorage.getItem("site-theme") || "system";
  const savedLang = localStorage.getItem("site-lang") || "system";

  if (themeSelect) {
    themeSelect.value = ["system", "dark", "light"].includes(savedTheme) ? savedTheme : "system";
    applyTheme(themeSelect.value);
  }

  if (langSelect) {
    langSelect.value = ["system", "fr", "en"].includes(savedLang) ? savedLang : "system";
    applyLanguage(langSelect.value, false);
  }

  if (musicAudio) {
    const savedVolume = Number(localStorage.getItem(musicVolumeStorageKey));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      musicAudio.volume = savedVolume;
      if (musicVolume) {
        musicVolume.value = String(savedVolume);
      }
    }
    musicAudio.muted = localStorage.getItem(musicMuteStorageKey) === "1";
    updateMuteButtonLabel();
  }

  syncMusicUi();

  loadPlaylist().then(() => {
    syncMusicUi();
    renderQueue();
    preloadPlaylistMetadata();
  });

  const shouldAnimateBrandFromLastPage = hasKnownLastPage;
  typeBrandTitle(titleByPage[pageName] || "Website", shouldAnimateBrandFromLastPage);
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
