(() => {
  const explicitAssetRoot = (document.body && document.body.dataset ? (document.body.dataset.assetRoot || "") : "").trim();
  const pathName = window.location.pathname || "";
  const isDeepNestedPage = /\/resources\/ninconvert(\/|$)/i.test(pathName);
  const isNestedPage = /\/(resources|credit|ninconvert|placeholder)(\/|$)/i.test(pathName);
  const inferredAssetRoot = isDeepNestedPage ? "../../assets/" : (isNestedPage ? "../assets/" : "assets/");
  const assetRoot = explicitAssetRoot || inferredAssetRoot;
  const basePath = `${assetRoot}Musics/`;
  const placeholderCover = `${assetRoot}images/album-placeholder.svg`;

  const fallbackTracks = [
    {
      file: "Kubbi _ Overworld.mp3",
      title: "Kubbi - Overworld",
      artist: "Kubbi",
      cover: `${basePath}covers/Kubbi.jpg`
    },
    {
      file: "PlasticSixwall.mp3",
      title: "≧◡≦",
      artist: "PlasticSixwall",
      cover: `${basePath}covers/plasticsixwall.jpg`
    },
    {
      file: "Sherbet Lobby - bxnji.mp3",
      title: "Sherbet Lobby",
      artist: "Nicopatty - bxnji",
      cover: `${basePath}covers/yume-nikki-madotsuki.gif`
    },
    {
      file: "nico's nextbots ost - kensuke.mp3",
      title: "Kensuke",
      artist: "Nicopatty",
      cover: `${basePath}covers/nico's - kensuke.gif`
    },
        {
      file: "猫叉Master - Back to chronos (Slowed).mp3",
      title: "Back to chronos (Slowed)",
      artist: "猫叉Master",
      cover: `${basePath}covers/Back to chronos.jpg`
    },
    {
      file: "FALL! (Slowed).mp3",
      title: "FALL ! (SLowed)",
      artist: "6IXXTY",
      cover: `${basePath}covers/FALL! (Slowed).jpg`
    }
    
  ];

  async function readPlaylistJson() {
    try {
      const response = await fetch(`${basePath}playlist.json`, { cache: "no-store" });
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      return Array.isArray(payload) ? payload : (payload?.tracks || []);
    } catch (_) {
      return [];
    }
  }

  window.SITE_MUSIC_PLAYLIST = { tracks: fallbackTracks };

  window.SITE_MUSIC_PLAYLIST_READY = (async () => {
    const jsonTracks = await readPlaylistJson();
    const tracks = jsonTracks.length ? jsonTracks : fallbackTracks;
    window.SITE_MUSIC_PLAYLIST.tracks = tracks;
    return tracks;
  })();
})();
