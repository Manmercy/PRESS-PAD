import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const data = { window: {} };
vm.runInNewContext(read('data/catalog.js'), data);
const catalog = data.window.PRESSPAD_CATALOG;
const schedule = data.window.PRESSPAD_BROADCASTS;
assert.equal(schedule.length, 4);
assert.equal(new Set(schedule.map((row) => row.date)).size, schedule.length);
for (const entry of schedule) {
  assert.equal(new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0, 10), entry.date);
  assert.ok(catalog.some((track) => track.id === entry.trackId));
}
const elements = new Map();
const $ = (id) => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', classList: { toggle() {} }, querySelector() { return {}; } });
  return elements.get(id);
};
const context = { $, $$: () => [], catalog, window: { PRESSPAD_BROADCASTS: [...schedule].reverse() },
  shelfIds: [schedule[0].trackId], receivedDaily: false, attachCoverFallback() {},
  escapeHtml: (text) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') };
const app = read('js/app.js');
const handlers = app.slice(app.indexOf('  function renderRadioHistory('), app.indexOf('  function renderShelf('));
vm.runInNewContext(handlers + '\nrenderRadioHistory();', context);
const markup = $('#radioHistory').innerHTML;
const dates = [...markup.matchAll(/datetime="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(dates, [...dates].sort().reverse());
assert.equal(dates.length, 4);
assert.equal((markup.match(/class="broadcast-open"/g) || []).length, 4);
assert.equal((markup.match(/BUY TAPE/g) || []).length, 3);
assert.equal((markup.match(/IN YOUR SHELF/g) || []).length, 1);
for (const entry of schedule) {
  const track = catalog.find((item) => item.id === entry.trackId);
  assert.ok(markup.includes(`data-play-track="${track.id}"`));
  assert.ok(markup.includes(track.cover));
  assert.ok(markup.includes(track.title));
}
context.shelfIds = schedule.map((entry) => entry.trackId);
vm.runInNewContext('updateRadio();', context);
assert.ok(!$('#radioHistory').innerHTML.includes('BUY TAPE'));
assert.deepEqual([...$('#radioHistory').innerHTML.matchAll(/datetime="([^"]+)"/g)].map((match) => match[1]), dates, 'Buying must not change broadcast dates');
context.window.PRESSPAD_BROADCASTS = [{ date: '2026-02-30', trackId: catalog[0].id }, { date: '2026-09-03', trackId: 'missing' }];
vm.runInNewContext('renderRadioHistory();', context);
assert.ok($('#radioHistory').innerHTML.includes('No past broadcasts yet.'));
assert.ok(read('index.html').includes('Demo schedule · Newest first'));
assert.equal((read('index.html').match(/scope="col"/g) || []).length, 3);
assert.ok(read('css/styles.css').includes('grid-template-columns: 64px minmax(0, 1fr)'));
console.log('PASS: fixed demo dates, descending history, 3-column table, correct cover/detail links, ownership refresh, invalid/empty schedule, mobile layout rules.');
