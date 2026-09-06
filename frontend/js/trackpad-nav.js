(() => {
  const compactNavigation = window.matchMedia("(max-width: 1180px)");
  let accumulatedX = 0;
  let resetTimer = null;

  function appIsVisible() {
    const app = document.getElementById("appView");
    return Boolean(app && !app.classList.contains("hidden"));
  }

  function sidebarOpen() {
    return document.getElementById("sidebar")?.classList.contains("open");
  }

  function gestureBlocked(target) {
    return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true'], .modal, .assistant-indicator-popover"));
  }

  function resetAccumulatorSoon() {
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { accumulatedX = 0; }, 140);
  }

  document.addEventListener("wheel", (event) => {
    if (!compactNavigation.matches || !appIsVisible() || gestureBlocked(event.target)) return;

    const horizontal = Math.abs(event.deltaX) > 3 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15;
    if (!horizontal) {
      accumulatedX = 0;
      return;
    }

    // A horizontal two-finger trackpad gesture is navigation inside Atlas,
    // not browser Back/Forward. Cancel the native browser navigation gesture.
    if (event.cancelable) event.preventDefault();

    accumulatedX += event.deltaX;
    resetAccumulatorSoon();

    if (!sidebarOpen() && accumulatedX <= -55) {
      accumulatedX = 0;
      document.getElementById("menuBtn")?.click();
      return;
    }

    if (sidebarOpen() && accumulatedX >= 55) {
      accumulatedX = 0;
      document.getElementById("closeSidebarBtn")?.click();
    }
  }, { passive: false, capture: true });
})();
