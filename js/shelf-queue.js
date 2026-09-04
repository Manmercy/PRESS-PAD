(() => {
  'use strict';
  window.createPresspadShelfQueue = () => {
    let ids = [];
    let index = -1;
    const current = () => ids[index] || null;
    const clear = () => { ids = []; index = -1; };
    return {
      current, clear,
      read: () => ({ ids: [...ids], index }),
      start(shelfIds) { ids = [...new Set(shelfIds)]; index = ids.length ? 0 : -1; return current(); },
      next(ownedIds) {
        if (!current()) return null;
        const owned = new Set(ownedIds);
        do { index++; } while (index < ids.length && !owned.has(ids[index]));
        if (index >= ids.length) { clear(); return null; }
        return current();
      },
    };
  };
})();
