(() => {
  const basePath = "assets/Musics/";
  const fallbackTracks = [
    {
      file: "Mr. Blue Sky.mp3",
      title: "Mr. Blue Sky",
      artist: "Electric Light Orchestra",
      cover: "assets/Musics/covers/mr-blue-sky.jpg"
    },
    {
      file: "Kubbi _ Overworld.mp3",
      title: "Kubbi - Overworld",
      artist: "Kubbi",
      cover: "assets/images/album-placeholder.svg"
    },
    {
      file: "PlasticSixwall.mp3",
      title: "PlasticSixwall",
      artist: "CTRL_J",
      cover: "assets/images/album-placeholder.svg"
    },
    {
      file: "EEYUH 2_audio only.mp3",
      title: "EEYUH 2",
      artist: "HR",
      cover: "assets/Musics/covers/FLUXXKLUB!.jpg"
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
