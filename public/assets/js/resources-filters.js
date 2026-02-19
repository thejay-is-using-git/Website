(() => {
  function getResourceCardTag(card) {
    const explicitTag = (card && card.dataset && card.dataset.platform ? card.dataset.platform : "")
      .toLowerCase()
      .trim();
    if (explicitTag) {
      return explicitTag;
    }

    const badge = card ? card.querySelector(".resource-badge") : null;
    const label = (badge && badge.textContent ? badge.textContent : "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (/\bwii\s*u\b/.test(label)) {
      return "wiiu";
    }
    if (/\bwii\b/.test(label)) {
      return "wii";
    }
    if (/\btool\b/.test(label)) {
      return "other";
    }
    return "";
  }

  function initResourcesFilters() {
    const filterButtons = Array.from(document.querySelectorAll(".resources-filters .filter-chip"));
    const cards = Array.from(document.querySelectorAll(".resource-card-grid .resource-card"));
    const grid = document.querySelector(".resource-card-grid");
    const searchInput = document.getElementById("resources-search");
    const emptyState = document.getElementById("resources-empty");
    if (!filterButtons.length || !cards.length || !grid) {
      return;
    }

    const hideDurationMs = 260;
    const showDurationMs = 420;
    const stretchDurationMs = 680;

    let activeFilter = (filterButtons.find((btn) => btn.classList.contains("active")) || filterButtons[0]).dataset.filter || "all";
    let lastSingleCardId = "";
    let lastVisibleCount = cards.length;

    function applyCornerPress(card, event) {
      const rect = card.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / Math.max(1, rect.width);
      const relY = (event.clientY - rect.top) / Math.max(1, rect.height);

      const horizontal = relX <= 0.5 ? "left" : "right";
      const vertical = relY <= 0.5 ? "top" : "bottom";

      card.style.setProperty("--r-tl", "20px");
      card.style.setProperty("--r-tr", "20px");
      card.style.setProperty("--r-br", "20px");
      card.style.setProperty("--r-bl", "20px");

      if (vertical === "top" && horizontal === "left") {
        card.style.setProperty("--r-tl", "11px");
      } else if (vertical === "top" && horizontal === "right") {
        card.style.setProperty("--r-tr", "11px");
      } else if (vertical === "bottom" && horizontal === "right") {
        card.style.setProperty("--r-br", "11px");
      } else {
        card.style.setProperty("--r-bl", "11px");
      }

      if (card.__cornerTimer) {
        clearTimeout(card.__cornerTimer);
      }
      card.__cornerTimer = setTimeout(() => {
        card.style.setProperty("--r-tl", "20px");
        card.style.setProperty("--r-tr", "20px");
        card.style.setProperty("--r-br", "20px");
        card.style.setProperty("--r-bl", "20px");
        card.__cornerTimer = null;
      }, 240);
    }

    cards.forEach((card, index) => {
      card.dataset.filterTag = getResourceCardTag(card);
      card.dataset.gridSlot = index % 2 === 0 ? "left" : "right";
      card.dataset.cardId = `resource-${index}`;
      card.classList.add("is-clickable");

      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / Math.max(1, rect.width);
        const relY = (event.clientY - rect.top) / Math.max(1, rect.height);
        const offsetX = (relX - 0.5) * 8;
        const offsetY = (relY - 0.5) * 8;
        card.style.setProperty("--jelly-x", `${offsetX.toFixed(2)}px`);
        card.style.setProperty("--jelly-y", `${offsetY.toFixed(2)}px`);
      });

      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--jelly-x", "0px");
        card.style.setProperty("--jelly-y", "0px");
      });

      card.addEventListener("click", (event) => {
        const targetLink = event.target.closest("a");
        if (targetLink) {
          event.preventDefault();
        }

        applyCornerPress(card, event);

        card.classList.remove("is-jelly");
        void card.offsetWidth;
        card.classList.add("is-jelly");
        setTimeout(() => {
          card.classList.remove("is-jelly");
        }, 520);

        const href = (card.dataset.link || "").trim();
        if (href) {
          window.location.href = href;
        }
      });
    });

    function hideCard(card) {
      if (card.classList.contains("is-filter-gone")) {
        return;
      }
      if (card.__filterTimer) {
        clearTimeout(card.__filterTimer);
        card.__filterTimer = null;
      }
      card.classList.remove("is-filter-enter-left");
      card.classList.remove("is-filter-enter-right");
      card.classList.remove("is-filter-enter-fade");
      card.classList.add("is-filter-exit");
      card.__filterTimer = setTimeout(() => {
        card.classList.add("is-filter-gone");
        card.classList.remove("is-filter-exit");
        card.__filterTimer = null;
      }, hideDurationMs);
    }

    function showCard(card, mode = "slide") {
      if (card.__filterTimer) {
        clearTimeout(card.__filterTimer);
        card.__filterTimer = null;
      }

      const wasGone = card.classList.contains("is-filter-gone");
      card.classList.remove("is-filter-gone");
      card.classList.remove("is-filter-exit");
      card.classList.remove("is-filter-enter-left");
      card.classList.remove("is-filter-enter-right");
      card.classList.remove("is-filter-enter-fade");

      if (!wasGone) {
        return;
      }

      const slot = (card.dataset.gridSlot || "left").toLowerCase();
      const enterClass = mode === "fade"
        ? "is-filter-enter-fade"
        : (slot === "right" ? "is-filter-enter-right" : "is-filter-enter-left");

      requestAnimationFrame(() => {
        card.classList.add(enterClass);
      });

      card.__filterTimer = setTimeout(() => {
        card.classList.remove("is-filter-enter-left");
        card.classList.remove("is-filter-enter-right");
        card.classList.remove("is-filter-enter-fade");
        card.__filterTimer = null;
      }, showDurationMs);
    }

    function setGridLayout(visibleCards) {
      const visibleCount = visibleCards.length;

      cards.forEach((card) => {
        card.classList.remove("is-last-odd");
        card.classList.remove("is-last-odd-from-left");
        card.classList.remove("is-last-odd-from-right");
        card.classList.remove("is-last-odd-animate");
        card.classList.remove("is-single-from-left");
        card.classList.remove("is-single-from-right");
      });

      grid.classList.remove("is-single-animate");
      grid.classList.toggle("is-single", visibleCount === 1);

      if (visibleCount === 1) {
        const only = visibleCards[0];
        const slot = (only.dataset.gridSlot || "left").toLowerCase();
        const cardId = only.dataset.cardId || "";
        only.classList.add(slot === "right" ? "is-single-from-right" : "is-single-from-left");
        if (lastVisibleCount !== 1 || lastSingleCardId !== cardId) {
          grid.classList.add("is-single-animate");
          if (grid.__singleAnimTimer) {
            clearTimeout(grid.__singleAnimTimer);
          }
          grid.__singleAnimTimer = setTimeout(() => {
            grid.classList.remove("is-single-animate");
            grid.__singleAnimTimer = null;
          }, stretchDurationMs);
        }
        lastSingleCardId = cardId;
      } else if (visibleCount > 1 && visibleCount % 2 === 1) {
        const last = visibleCards[visibleCards.length - 1];
        const slot = (last.dataset.gridSlot || "left").toLowerCase();
        last.classList.add("is-last-odd");
        last.classList.add(slot === "right" ? "is-last-odd-from-right" : "is-last-odd-from-left");
        if (lastVisibleCount !== visibleCount) {
          last.classList.add("is-last-odd-animate");
          if (last.__oddAnimTimer) {
            clearTimeout(last.__oddAnimTimer);
          }
          last.__oddAnimTimer = setTimeout(() => {
            last.classList.remove("is-last-odd-animate");
            last.__oddAnimTimer = null;
          }, stretchDurationMs);
        }
        lastSingleCardId = "";
      } else {
        lastSingleCardId = "";
      }

      lastVisibleCount = visibleCount;
    }

    function applyFilter(filterKey, trigger = "filter") {
      activeFilter = filterKey || "all";
      const query = (searchInput && searchInput.value ? searchInput.value : "").toLowerCase().trim();
      const currentlyVisible = cards.filter((card) => !card.classList.contains("is-filter-gone"));
      const nextVisible = [];
      const entering = [];

      filterButtons.forEach((btn) => {
        const key = btn.dataset.filter || "all";
        btn.classList.toggle("active", key === activeFilter);
      });

      cards.forEach((card) => {
        const tag = card.dataset.filterTag || "";
        const searchable = (card.textContent || "").toLowerCase();
        const matchesSearch = !query || searchable.includes(query);
        const matchesFilter = activeFilter === "all" || tag === activeFilter;
        const shouldShow = matchesFilter && matchesSearch;
        const isVisible = !card.classList.contains("is-filter-gone");

        if (shouldShow) {
          nextVisible.push(card);
          if (!isVisible || card.classList.contains("is-filter-exit")) {
            entering.push(card);
          }
        } else if (isVisible) {
          hideCard(card);
        }
      });

      const singleSwap = currentlyVisible.length === 1 &&
        nextVisible.length === 1 &&
        currentlyVisible[0] !== nextVisible[0];

      entering.forEach((card) => {
        showCard(card, singleSwap || trigger === "search" ? "fade" : "slide");
      });

      setGridLayout(nextVisible);

      if (emptyState) {
        emptyState.hidden = nextVisible.length > 0;
      }
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyFilter(button.dataset.filter || "all", "filter");
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        applyFilter(activeFilter, "search");
      });
    }

    applyFilter(activeFilter, "filter");
  }

  window.initResourcesFilters = initResourcesFilters;
})();
