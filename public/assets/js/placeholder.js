(() => {
  const barrier = document.getElementById("placeholder-barrier");
  if (!barrier) {
    return;
  }

  const src = (barrier.dataset.barrierSrc || "").trim();
  if (!src) {
    return;
  }

  const probe = new Image();
  probe.onload = () => {
    barrier.style.setProperty("--placeholder-barrier-image", `url("${src}")`);
    barrier.classList.add("has-image");
  };
  probe.src = src;
})();
