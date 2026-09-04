import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const factory = { window: {} };
vm.runInNewContext(read('js/collection.js'), factory);
const values = new Map([['unrelated-app-data', 'preserve']]);
let failWrite = false;
const storage = { getItem: (key) => values.get(key) ?? null, setItem(key, value) { if (failWrite) throw new Error('blocked'); values.set(key, value); }, removeItem: (key) => values.delete(key) };
const makeStore = () => factory.window.createPresspadCollection(storage, ['a', 'b'], ['a']);
const store = makeStore();
assert.equal(store.read().balanceCents, 10000);
assert.deepEqual([...store.read().shelfIds], ['a']);
values.set('presspad-v012-shelf', JSON.stringify(['b', 'b', 'invalid']));
assert.deepEqual([...store.read().shelfIds], ['b']);
values.set('presspad-v012-shelf', '[]');
assert.equal(store.read().shelfIds.length, 0, 'Empty legacy shelf must stay empty');
failWrite = true;
assert.throws(() => store.buy('a'));
assert.equal(store.read().balanceCents, 10000);
assert.equal(store.read().shelfIds.length, 0);
failWrite = false;
assert.equal(store.buy('a').status, 'purchased');
assert.equal(store.buy('a').status, 'owned');
assert.equal(makeStore().read().balanceCents, 9900);
values.set(store.key, JSON.stringify({ version: 1, balanceCents: 0, shelfIds: [] }));
assert.equal(store.buy('b').status, 'insufficient');
values.set(store.key, JSON.stringify({ version: 1, balanceCents: 100, shelfIds: [] }));
assert.equal(store.buy('a').account.balanceCents, 0, 'Last dollar can purchase one tape');
assert.equal(store.buy('b').status, 'insufficient');
assert.throws(() => store.buy('unknown'));
store.reset();
assert.equal(makeStore().read().balanceCents, 10000);
assert.equal(makeStore().read().shelfIds.length, 0);
assert.equal(values.get('unrelated-app-data'), 'preserve');

// Execute real app purchase/playback/reset handlers, with no browser or real storage.
const app = read('js/app.js');
const elements = new Map();
function element() { return { textContent: '', hidden: false, disabled: false, src: '', dataset: {}, querySelector() { return element(); }, classList: { add() {}, remove() {} } }; }
const $ = (id) => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
let played = 0, reopened = 0, reloaded = 0;
const a = { id: 'a', title: 'A', cover: 'a.webp', audio: 'a.m4a', artist: 'Artist A' };
const b = { id: 'b', title: 'B', cover: 'b.webp', audio: 'b.m4a', artist: 'Artist B' };
const context = { $, collection: store, dailyTrack: a, ritualTrack: b, currentTrack: a, shelfIds: [], walletCents: 10000,
  shelfQueue: { current: () => null }, playbackRequest: 0, stopShelfQueue() {},
  receivedDaily: false, showToast() {}, clearRitualTimers() {}, renderDiscover() {}, renderShelf() {}, updateRadio() {}, playSfx() {},
  attachCoverFallback() {}, updatePlayer() {}, setRitualState() {}, openRitual() { reopened++; },
  caseScene: { classList: { contains: () => false } }, ritualAction: element(), playingActions: element(), skipRitual: element(),
  globalPlayer: element(), appShell: element(), reduceMotion: true,
  audio: { paused: true, dataset: {}, play() { played++; this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } },
  entryMusic: { pause() {} }, window: { confirm: () => false, location: { reload() { reloaded++; } } } };
const helpers = app.slice(app.indexOf('  function readShelf('), app.indexOf('  function escapeHtml('));
const playback = app.slice(app.indexOf('  function beginInsertion('), app.indexOf('  function updatePlayer('));
const purchase = app.slice(app.indexOf('  function buyCurrentTape('), app.indexOf("  loginForm.addEventListener('submit'"));
vm.runInNewContext(helpers + playback + purchase, context);
vm.runInNewContext('startTrack(ritualTrack); beginInsertion(); completeInsertion(); togglePlayback(ritualTrack);', context);
assert.equal(played, 0, 'Every playback entry must block unowned tracks');
assert.ok(reopened > 0);
vm.runInNewContext('buyCurrentTape(); buyCurrentTape();', context);
assert.equal(store.read().balanceCents, 9900);
assert.deepEqual([...store.read().shelfIds], ['b']);
vm.runInNewContext('beginInsertion();', context);
assert.equal(played, 1);
assert.equal(context.audio.src, 'b.m4a');
vm.runInNewContext('resetLocalData();', context);
assert.equal(reloaded, 0);
assert.equal(store.read().balanceCents, 9900);
context.window.confirm = () => true;
vm.runInNewContext('resetLocalData();', context);
assert.equal(reloaded, 1);
assert.equal(store.read().balanceCents, 10000);
assert.equal(store.read().shelfIds.length, 0);
assert.equal(values.get('unrelated-app-data'), 'preserve');
values.set(store.key, '{invalid');
vm.runInNewContext('startTrack(ritualTrack);', context);
assert.equal(played, 1, 'Invalid storage must not grant free playback');
const html = read('index.html');
assert.ok(html.includes('cassette-player-blue-v012.webp'));
assert.ok(html.indexOf('js/collection.js') < html.indexOf('js/app.js'));
assert.ok(read('css/styles.css').includes('.header-tools .settings-link { display: none; }'));
console.log('PASS: $100 wallet, $1 purchase, no duplicate charge, migration/reload, insufficient funds, storage failure, playback guards, confirmed scoped reset, mobile Settings.');
