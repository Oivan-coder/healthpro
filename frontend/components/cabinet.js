
/* Small, dependency-free presentation helpers shared by patient screens. */
window.Cabinet = (() => {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const display = value => value == null || String(value).trim() === "" || value === "null" ? "—" : String(value);
  const numeric = value => value == null || String(value).trim() === "" ? null : Number.isFinite(Number(String(value).replace(",", "."))) ? Number(String(value).replace(",", ".")) : null;
  const attention = lab => ["high", "low", "warn", "critical"].includes(lab.flag);
  const status = flag => `<span class="result-status ${attention({flag}) ? "attention" : flag === "normal" ? "normal" : "unknown"}">${escape(({normal:"В диапазоне",high:"Выше диапазона",low:"Ниже диапазона",warn:"Требует внимания",critical:"Требует внимания"})[flag] || "Нет оценки")}</span>`;
  const reference = row => {
    if (row.referenceLabel) return escape(row.referenceLabel);
    const low = numeric(row.low), high = numeric(row.high);
    return low !== null && high !== null ? `${low}–${high}` : low !== null ? `от ${low}` : high !== null ? `до ${high}` : "—";
  };
  const value = row => `${escape(display(row.latestValue ?? row.value))}${row.unit ? ` <small>${escape(row.unit)}</small>` : ""}`;
  const plural = (count,one,few,many) => {
    const mod10=count%10,mod100=count%100;
    return mod10===1 && mod100!==11 ? one : mod10>=2 && mod10<=4 && (mod100<12 || mod100>14) ? few : many;
  };
  function bindFavorites() {
    UI.root().querySelectorAll("[data-favorite-code]").forEach(button => button.onclick = event => {
      event.preventDefault(); event.stopPropagation();
      toggleFavoriteLab(button.dataset.favoriteCode);
      const active = isFavoriteLab(button.dataset.favoriteCode);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Убрать показатель из избранного" : "Добавить показатель в избранное");
      UI.toast(active ? "Добавлено в избранное" : "Убрано из избранного");
    });
  }
  let searchVersion = 0, searchTimer;
  function search(input, setQuery) {
    input.addEventListener("input", () => {
      setQuery(input.value);
      const version = ++searchVersion, id = input.id, caret = input.selectionStart;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        if (!input.isConnected) return;
        await App.render();
        if (version !== searchVersion) return;
        const next = document.getElementById(id);
        next?.focus({preventScroll:true});
        if (next?.type === "text") next.setSelectionRange(caret, caret);
      }, 180);
    });
  }
  return {escape, display, numeric, attention, status, reference, value, plural, bindFavorites, search};
})();
