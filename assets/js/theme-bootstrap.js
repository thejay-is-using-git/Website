(function () {
  try {
    var theme = localStorage.getItem("site-theme") || "system";
    if (theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    // Ignore storage/media query errors and keep default theme.
  }
})();

