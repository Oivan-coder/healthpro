
/* Keyboard-accessible autocomplete with at most eight suggestions. */
window.SearchPicker = function SearchPicker(input, selected, {items, label = item => item.name, terms = label, onChange, hint}) {
  const list = document.createElement("div");
  list.className = "search-options";
  list.id = input.id + "Options"; list.setAttribute("role","listbox"); list.hidden = true;
  const wrap = document.createElement("div"); wrap.className = "search-picker";
  // Keep options outside the label: its default click action would refocus the search.
  const field = input.closest("label") || input;
  field.parentNode.insertBefore(wrap,field); wrap.append(field,list);
  input.setAttribute("role","combobox"); input.setAttribute("aria-autocomplete","list");
  input.setAttribute("aria-expanded","false"); input.setAttribute("aria-controls",list.id);
  const normalize = value => String(value || "").toLowerCase().replace(/ё/g,"е").trim();
  let shown = [], active = -1;
  function close() {list.hidden = true;active = -1;input.setAttribute("aria-expanded","false");input.removeAttribute("aria-activedescendant");}
  function choose(index) {
    const item = shown[index]; if (!item || input.disabled) return;
    selected.value = String(item.id); input.value = label(item); close(); onChange(item);
  }
  function refresh(open = false) {
    if (input.disabled) return close();
    const available = items();
    const chosen = available.find(item => String(item.id) === selected.value);
    const query = chosen && input.value === label(chosen) ? "" : normalize(input.value);
    const matches = available.filter(item => !query || normalize(terms(item)).includes(query));
    shown = matches.slice(0,8); active = -1; input.removeAttribute("aria-activedescendant");
    list.replaceChildren();
    shown.forEach((item,index) => {
      const option = document.createElement("div");
      option.id = list.id + "-" + index; option.setAttribute("role","option");
      option.setAttribute("aria-selected","false"); option.textContent = label(item);
      option.addEventListener("mousedown",event => event.preventDefault());
      option.addEventListener("click",event => {event.preventDefault();choose(index);});
      list.append(option);
    });
    const note = document.createElement("small");note.className = "picker-note";
    note.textContent = !matches.length ? "Ничего не найдено" : matches.length > 8 ? `Показаны 8 из ${matches.length}. Уточните название или код.` : `Найдено: ${matches.length}`;
    list.append(note);
    if (hint) hint.textContent = selected.value ? "Выбрано из справочника" : note.textContent;
    list.hidden = !open; input.setAttribute("aria-expanded",String(open));
  }
  input.addEventListener("input",() => {selected.value = "";onChange(null);refresh(true);});
  input.addEventListener("focus",() => refresh(true));
  input.addEventListener("blur",close);
  input.addEventListener("keydown",event => {
    if (event.key === "Escape") {event.preventDefault();close();return;}
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (list.hidden) refresh(true); if (!shown.length) return;
      active = active < 0 ? (event.key === "ArrowDown" ? 0 : shown.length - 1)
        : (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      [...list.querySelectorAll('[role="option"]')].forEach((option,index) => option.setAttribute("aria-selected",String(index === active)));
      const option = list.children[active];input.setAttribute("aria-activedescendant",option.id);option.scrollIntoView?.({block:"nearest"});
    } else if (event.key === "Enter" && !list.hidden) {
      event.preventDefault(); if (active >= 0) choose(active);
    }
  });
  return {refresh,close,set(item) {selected.value = item ? String(item.id) : "";input.value = item ? label(item) : "";close();}};
};
