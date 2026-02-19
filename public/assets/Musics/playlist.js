(() => {
  const isNestedPage = /\/(resources|credit|ninconvert)(\/|$)/i.test(window.location.pathname || "");
  const assetRoot = isNestedPage ? "../assets/" : "assets/";
  const basePath = `${assetRoot}Musics/`;
  const placeholderCover = `${assetRoot}images/album-placeholder.svg`;

  const fallbackTracks = [
    {
      file: "Mr. Blue Sky.mp3",
      title: "Mr. Blue Sky",
      artist: "Electric Light Orchestra",
      cover: `${basePath}covers/mr-blue-sky.jpg`
    },
    {
      file: "Kubbi _ Overworld.mp3",
      title: "Kubbi - Overworld",
      artist: "Kubbi",
      cover: placeholderCover
    },
    {
      file: "PlasticSixwall.mp3",
      title: "PlasticSixwall",
      artist: "CTRL_J",
      cover: placeholderCover
    },
    {
      file: "EEYUH 2_audio only.mp3",
      title: "EEYUH 2",
      artist: "HR",
      cover: `${basePath}covers/FLUXXKLUB!.jpg`
    },
    {
      file: "Sherbet Lobby - bxnji.mp3",
      title: "Sherbet Lobby",
      artist: "bxnji",
      cover: placeholderCover
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
    if (window.location.protocol === "file:") {
      window.SITE_MUSIC_PLAYLIST.tracks = fallbackTracks;
      return fallbackTracks;
    }

    const jsonTracks = await readPlaylistJson();
    const tracks = jsonTracks.length ? jsonTracks : fallbackTracks;
    window.SITE_MUSIC_PLAYLIST.tracks = tracks;
    return tracks;
  })();
})();
