window.HealthStore = (() => {
  const KEY = "health-id-v4-db";

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function init(force = false) {
    if (force || !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(clone(window.HealthMockDB)));
    }
    return get();
  }

  function get() {
    return JSON.parse(localStorage.getItem(KEY));
  }

  function set(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }

  function update(mutator) {
    const db = get();
    mutator(db);
    set(db);
    return db;
  }

  function reset() {
    return init(true);
  }

  return { init, get, set, update, reset };
})();
