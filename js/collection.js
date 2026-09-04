(() => {
  'use strict';
  // Device-local demo credits only. This is not a payment or access-control backend.
  const key = 'presspad-v012-account';
  window.createPresspadCollection = (storage, validIds, starterShelf = [], clock = () => new Date()) => {
    const known = new Set(validIds);
    const cleanIds = (ids) => [...new Set(Array.isArray(ids) ? ids.filter((id) => known.has(id)) : [])];
    const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dayKey(new Date(`${day}T12:00:00`)) === day;
    function journal(saved) {
      const events = (Array.isArray(saved.events) ? saved.events : []).filter(event => event && known.has(event.trackId) && validDay(event.date) && ['purchase', 'radio'].includes(event.type)).map(event => ({ date: event.date, trackId: event.trackId, type: event.type }));
      const notes = Object.fromEntries(Object.entries(saved.notes || {}).filter(([day, note]) => validDay(day) && typeof note === 'string').map(([day, note]) => [day, note.slice(0, 2000)]));
      return { events, notes };
    }
    function read() {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !Number.isInteger(saved.balanceCents) || saved.balanceCents < 0 || saved.balanceCents > 10000 || !Array.isArray(saved.shelfIds)) throw new Error('Invalid local account');
        return { version: 1, balanceCents: saved.balanceCents, shelfIds: cleanIds(saved.shelfIds), ...journal(saved) };
      }
      const legacy = storage.getItem('presspad-v012-shelf');
      return { version: 1, balanceCents: 10000, shelfIds: cleanIds(legacy === null ? starterShelf : JSON.parse(legacy)), events: [], notes: {} };
    }
    function buy(id) {
      if (!known.has(id)) throw new Error('Unknown tape');
      const account = read();
      if (account.shelfIds.includes(id)) return { status: 'owned', account };
      if (account.balanceCents < 100) return { status: 'insufficient', account };
      const next = { ...account, balanceCents: account.balanceCents - 100, shelfIds: [...account.shelfIds, id], events: [...account.events, { date: dayKey(clock()), trackId: id, type: 'purchase' }] };
      // One storage write commits balance and ownership together; failure grants neither.
      storage.setItem(key, JSON.stringify(next));
      return { status: 'purchased', account: next };
    }
    function receive(id) {
      if (!known.has(id)) throw new Error('Unknown tape');
      const account = read();
      if (account.shelfIds.includes(id)) return { status: 'owned', account };
      const next = { ...account, shelfIds: [...account.shelfIds, id], events: [...account.events, { date: dayKey(clock()), trackId: id, type: 'radio' }] };
      storage.setItem(key, JSON.stringify(next));
      return { status: 'received', account: next };
    }
    function saveNote(day, text, expected) {
      if (!validDay(day) || typeof text !== 'string' || text.length > 2000) throw new Error('Invalid note');
      const account = read();
      // Do not silently overwrite edits made in another tab while the editor was open.
      if (expected !== undefined && (account.notes[day] || '') !== expected) throw new Error('Note changed in another tab. Reopen this date to load it.');
      const notes = { ...account.notes };
      if (text.trim()) notes[day] = text;
      else delete notes[day];
      storage.setItem(key, JSON.stringify({ ...account, notes }));
    }
    function reset() {
      const account = { version: 1, balanceCents: 10000, shelfIds: [], events: [], notes: {} };
      storage.setItem(key, JSON.stringify(account));
      for (const legacy of ['presspad-v012-shelf', 'presspad-v012-daily']) {
        try { storage.removeItem(legacy); } catch { /* New account already takes precedence. */ }
      }
      return account;
    }
    return { read, buy, receive, saveNote, reset, key };
  };
})();
