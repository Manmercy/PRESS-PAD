import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const context = { window: { confirm: () => false } };
vm.runInNewContext(read('js/collection.js') + read('js/calendar.js'), context);
const values = new Map([['unrelated', 'keep']]);
let failWrite = false;
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem(key, value) { if (failWrite) throw Error('Storage full'); values.set(key, value); },
  removeItem: key => values.delete(key),
};
const clock = () => new Date(2026, 8, 4, 0, 15);
const make = () => context.window.createPresspadCollection(storage, ['a', 'b', 'c'], ['a'], clock);
const store = make();
assert.equal(store.read().events.length, 0, 'Starter ownership does not invent past dates');
values.set(store.key, JSON.stringify({ version: 1, balanceCents: 9800, shelfIds: ['a'] }));
assert.equal(store.read().events.length, 0, 'Older accounts migrate without invented history');
store.buy('b');
assert.equal(store.read().balanceCents, 9700);
assert.equal(store.read().events[0].date, '2026-09-04', 'Records device-local day, not UTC day');
assert.equal(store.read().events[0].type, 'purchase');
store.buy('b');
assert.equal(store.read().events.length, 1);
store.receive('c');
assert.equal(store.read().balanceCents, 9700, 'Radio gift does not charge wallet');
assert.equal(store.read().events[1].type, 'radio');
store.receive('c');
assert.equal(store.read().events.length, 2);
store.receive('a');
assert.equal(store.read().events.length, 2, 'Opening an already-owned tape is not a new receipt');
const personal = 'เพลงวันนี้ดีมาก 🎵\n<script>alert(1)</script>';
store.saveNote('2026-09-04', personal, '');
assert.equal(make().read().notes['2026-09-04'], personal);
assert.equal(store.read().balanceCents, 9700);
assert.throws(() => store.saveNote('2026-02-30', 'invalid'));
assert.throws(() => store.saveNote('2026-09-04', 'a'.repeat(2001)));
assert.throws(() => store.saveNote('2026-09-04', 'stale', ''), /another tab/);
assert.equal(store.read().notes['2026-09-04'], personal);
store.saveNote('2026-09-04', '', personal);
assert.equal(store.read().notes['2026-09-04'], undefined);
const { monthDays, dayKey } = context.window.PRESSPAD_CALENDAR;
assert.equal(monthDays(2026, 8)[0], null); // Tuesday 1 September; Monday-first calendar.
assert.equal(monthDays(2026, 8)[1], '2026-09-01');
assert.equal(monthDays(2024, 1).filter(Boolean).length, 29);
assert.equal(monthDays(2025, 1).filter(Boolean).length, 28);
assert.equal(monthDays(2026, 12).find(Boolean), '2027-01-01');
assert.equal(dayKey(new Date(2026, 8, 4, 0, 1)), '2026-09-04');

// Exercise the actual diary UI handlers with lightweight DOM doubles.
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {
    value: '', textContent: '', innerHTML: '', open: false, events: {},
    addEventListener(type, fn) { this.events[type] = fn; },
    querySelector() { return { focus() {} }; },
    showModal() { this.open = true; }, close() { this.open = false; this.events.close?.(); },
  });
  return nodes.get(selector);
};
const root = { querySelector: node };
const diary = context.window.createPresspadCalendar(store, [
  { id: 'b', title: '<unsafe title>', artist: 'B', cover: 'b.webp' },
  { id: 'c', title: 'Radio song', artist: 'C', cover: 'c.webp' },
], root);
diary.render();
assert.match(node('#miniCalendar').innerHTML, /aria-haspopup="dialog"/);
const openDay = () => node('#miniCalendar').events.click({ target: { closest: () => ({ dataset: { day: '2026-09-04' } }) } });
openDay();
assert.ok(node('#diaryDialog').open);
assert.match(node('#diaryTracks').innerHTML, /Purchased · \$1.00/);
assert.match(node('#diaryTracks').innerHTML, /Received from Radio · Free/);
assert.ok(!node('#diaryTracks').innerHTML.includes('<unsafe title>'));
assert.match(node('#diaryTracks').innerHTML, /&lt;unsafe title&gt;/);
node('#diaryNote').value = personal;
node('#closeDiary').events.click();
assert.ok(node('#diaryDialog').open, 'Unsaved note not discarded without confirmation');
let cancelled = false;
node('#diaryDialog').events.cancel({ preventDefault() { cancelled = true; } });
assert.ok(cancelled);
const save = () => node('#diaryForm').events.submit({ preventDefault() {} });
failWrite = true;
save();
assert.match(node('#diaryStatus').textContent, /Could not save/);
assert.equal(node('#diaryNote').value, personal);
failWrite = false;
save();
assert.equal(make().read().notes['2026-09-04'], personal);
node('#closeDiary').events.click();
assert.equal(node('#diaryDialog').open, false);
openDay();
assert.equal(node('#diaryNote').value, personal);
assert.equal(node('#diaryNote').innerHTML, '');
node('#diaryNote').value = '';
save();
assert.equal(store.read().notes['2026-09-04'], undefined);
assert.match(node('#diaryStatus').textContent, /removed/);
const currentMonth = node('#calendarMonth').textContent;
node('#calendarPrevious').events.click();
assert.notEqual(node('#calendarMonth').textContent, currentMonth);
node('#calendarNext').events.click();
assert.equal(node('#calendarMonth').textContent, currentMonth);
node('#calendarToday').events.click();
assert.match(node('#miniCalendar').innerHTML, /aria-current="date"/);

store.reset();
const receivedStates = [];
const radioContext = {
  collection: store, dailyTrack: { id: 'c' },
  refreshAccount() {}, renderDiscover() {}, renderShelf() {}, updateRadio() {}, showToast() {},
  openRitual(track, daily, state) { receivedStates.push([track.id, daily, state]); },
};
const app = read('js/app.js');
vm.runInNewContext(app.slice(app.indexOf('  function receiveDailyTape('), app.indexOf('  function resetLocalData(')), radioContext);
vm.runInNewContext('receiveDailyTape(); receiveDailyTape();', radioContext);
assert.equal(store.read().balanceCents, 10000);
assert.equal(store.read().events.length, 1);
assert.deepEqual(receivedStates, [['c', true, 'sealed'], ['c', true, null]]);
store.reset();
failWrite = true;
assert.throws(() => store.receive('c'));
assert.throws(() => store.buy('b'));
assert.equal(store.read().events.length, 0);
assert.equal(store.read().shelfIds.length, 0);
assert.equal(store.read().balanceCents, 10000);
const openedBeforeFailure = receivedStates.length;
vm.runInNewContext('receiveDailyTape()', radioContext);
assert.equal(receivedStates.length, openedBeforeFailure, 'Failed receipt does not open/unlock a tape');
failWrite = false;
assert.equal(Object.keys(store.read().notes).length, 0);
assert.equal(values.get('unrelated'), 'keep');
const html = read('index.html');
assert.ok(html.indexOf('js/calendar.js') < html.indexOf('js/app.js'));
assert.match(html, /id="diaryNote" maxlength="2000"/);
const css = read('css/styles.css');
assert.ok(!css.includes('align-items: end; padding: clamp(100px'));
assert.match(css, /width: min\(640px, 100%\); margin: 40px auto 0/);
assert.match(read('js/app.js'), /receiveButton'\)\.addEventListener\('click', receiveDailyTape\)/);
assert.ok(!read('js/app.js').includes('BGM / TAP TO PLAY'));
console.log('PASS: diary migration, purchases/Radio/local dates, notes save/reopen/delete/conflict, safe text, storage failure, calendar months/leap years, reset, centered mobile Login.');
