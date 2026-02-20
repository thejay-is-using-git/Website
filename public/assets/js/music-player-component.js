(() => {
  const slot = document.getElementById("music-player-slot");
  if (!slot || slot.dataset.ready === "1") {
    return;
  }

  const explicitAssetRoot = (document.body && document.body.dataset ? (document.body.dataset.assetRoot || "") : "").trim();
  const pathName = window.location.pathname || "";
  const isDeepNestedPage = /\/resources\/ninconvert(\/|$)/i.test(pathName);
  const isNestedPage = /\/(resources|credit|ninconvert|placeholder)(\/|$)/i.test(pathName);
  const inferredAssetRoot = isDeepNestedPage ? "../../assets/" : (isNestedPage ? "../assets/" : "assets/");
  const assetRoot = explicitAssetRoot || inferredAssetRoot;
  const placeholderCover = `${assetRoot}images/album-placeholder.svg`;
  const defaultTrack = `${assetRoot}Musics/Mr.%20Blue%20Sky.mp3`;
  const iconBase = `${assetRoot}images/icons/`;

  slot.innerHTML = `
    <div class="tool-pop">
      <button class="music-btn" id="music-btn" type="button" aria-expanded="false" aria-controls="music-panel" aria-label="Musique">
        <img class="ui-icon" src="${iconBase}music.webp" alt="" aria-hidden="true">
      </button>
      <div class="music-panel" id="music-panel" aria-hidden="true">
        <div class="music-head">
          <p class="music-title" id="music-title">Music Player</p>
          <button class="music-mini-btn music-queue-toggle" id="music-queue-btn" type="button" aria-expanded="false" aria-controls="music-queue-panel" aria-label="Queue" title="Queue">
            <img class="ui-icon" src="${iconBase}queue.webp" alt="" aria-hidden="true">
          </button>
        </div>
        <div class="music-now">
          <img class="music-cover" src="${placeholderCover}" alt="Album cover" onerror="this.src='${placeholderCover}'">
          <div class="music-meta">
            <p class="music-track-title" id="music-track-title">CTRL_J Theme</p>
            <p class="music-track-composer" id="music-track-composer">by CTRL_J</p>
          </div>
        </div>
        <div class="music-progress-wrap">
          <input class="music-progress" id="music-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Music progress">
          <div class="music-time-nav">
            <button class="music-mini-btn" id="music-prev-btn" type="button" aria-label="Previous track" title="Previous">
              <img class="ui-icon" src="${iconBase}prev.webp" alt="" aria-hidden="true">
            </button>
            <span id="music-current-time">0:00</span>
            <span class="music-time-sep">/</span>
            <span id="music-duration">0:00</span>
            <button class="music-mini-btn" id="music-next-btn" type="button" aria-label="Next track" title="Next">
              <img class="ui-icon" src="${iconBase}next.webp" alt="" aria-hidden="true">
            </button>
          </div>
        </div>
        <div class="music-controls">
          <button class="music-play-btn" id="music-play-btn" type="button" aria-label="Play" title="Play">
            <img class="ui-icon" id="music-play-icon" src="${iconBase}play.webp" alt="" aria-hidden="true">
          </button>
          <button class="music-mini-btn" id="music-mute-btn" type="button" aria-label="Mute" title="Mute">
            <img class="ui-icon" id="music-mute-icon" src="${iconBase}volume.webp" alt="" aria-hidden="true">
          </button>
          <input class="music-volume" id="music-volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">
        </div>
        <div class="music-queue-panel" id="music-queue-panel" aria-hidden="true">
          <div class="music-queue-head">
            <p class="music-queue-title" id="music-queue-title">Up Next</p>
            <button class="music-mini-btn" id="music-shuffle-btn" type="button" aria-label="Shuffle" title="Shuffle">
              <img class="ui-icon" src="${iconBase}shuffle.webp" alt="" aria-hidden="true">
            </button>
          </div>
          <div class="music-queue-list" id="music-queue-list"></div>
        </div>
        <audio id="music-audio" preload="metadata">
          <source src="${defaultTrack}" type="audio/mpeg">
        </audio>
      </div>
    </div>
  `;

  slot.dataset.ready = "1";
})();
