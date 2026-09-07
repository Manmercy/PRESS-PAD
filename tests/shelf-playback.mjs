import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const factory = { window: {} };
vm.runInNewContext(read('js/shelf-queue.js'), factory);
const queue = factory.window.createPresspadShelfQueue();
assert.equal(queue.start([]), null);
assert.equal(queue.start(['a', 'a', 'b', 'c']), 'a');
assert.equal(queue.read().ids.length, 3);
const copy = queue.read(); copy.ids.pop();
assert.equal(queue.read().ids.length, 3, 'Snapshots cannot mutate the queue');
assert.equal(queue.next(['a', 'c']), 'c');
assert.equal(queue.next(['a', 'c']), null);
assert.equal(queue.current(), null);
assert.equal(queue.next(['a', 'c']), null);

// Real queue/playback handlers, simulated ended events, no real audio/user data.
const app = read('js/app.js');
const tracks = ['a', 'b', 'c'].map(id => ({ id, title: id.toUpperCase(), artist: 'Artist', cover: `${id}.webp`, audio: `${id}.m4a` }));
const elements = new Map();
const $ = selector => {
  if (!elements.has(selector)) elements.set(selector, { textContent: '', hidden: false, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } });
  return elements.get(selector);
};
let owned = ['a', 'b', 'c'];
let openings = 0;
let plays = 0;
let mode = 'ok';
let finishPending;
const audio = {
  paused: true, ended: false, currentTime: 0, dataset: {},
  set src(value) { this.source = value; this.paused = true; this.ended = false; },
  play() {
    plays++;
    if (mode === 'blocked') return Promise.reject({ name: 'NotAllowedError' });
    if (mode === 'pending') return new Promise(resolve => { finishPending = () => { this.paused = false; resolve(); }; });
    this.paused = false; this.ended = false;
    return Promise.resolve();
  },
  pause() { this.paused = true; },
};
const context = { $, $$: () => [], catalog: tracks, shelfQueue: queue, shelfIds: [...owned],
  playbackRequest: 0, currentTrack: tracks[0], ritualTrack: tracks[0], audio,
  ritualDialog: { open: false }, globalPlayer: {}, appShell: { hidden: false, classList: { add() {} } },
  refreshAccount() { context.shelfIds = [...owned]; }, canPlay(track) { return owned.includes(track.id); },
  clearRitualTimers() {}, attachCoverFallback() {}, playSfx() {},
  showToast(message) { context.message = message; },
  updatePlayer() { vm.runInContext('updateShelfPlayButton()', context); },
  openRitual(track, daily, state) { openings++; context.ritualTrack = track; context.ritualDialog.open = true; context.state = state; },
};
vm.createContext(context);
const handlers = app.slice(app.indexOf('  function updateShelfPlayButton('), app.indexOf('  function ejectTape('));
const start = app.slice(app.indexOf('  function startTrack('), app.indexOf('  function updatePlayer('));
const toggle = app.slice(app.indexOf('  function togglePlayback('), app.indexOf('  function receiveDailyTape('));
vm.runInContext(handlers + start + toggle, context);
const call = code => vm.runInContext(code, context);
const flush = () => new Promise(resolve => setImmediate(resolve));
call('playShelf()'); await flush();
assert.equal(audio.dataset.trackId, 'a');
assert.equal(context.state, 'playing');
assert.equal($('#playShelf').textContent, 'Ⅱ PAUSE SHELF');
assert.match($('#shelfPlayStatus').textContent, /1 \/ 3/);
call('playShelf(); updateShelfPlayButton()');
assert.ok(audio.paused);
assert.equal(queue.current(), 'a');
assert.equal($('#playShelf').textContent, '▶ RESUME SHELF');
call('playShelf()'); await flush();
assert.equal(queue.current(), 'a');
audio.paused = true; audio.ended = true;
call('advanceShelfQueue()'); await flush();
assert.equal(audio.dataset.trackId, 'b');
assert.equal(context.ritualTrack.id, 'b');
assert.match($('#shelfPlayStatus').textContent, /2 \/ 3/);
context.ritualDialog.open = false;
const before = openings;
audio.paused = true; audio.ended = true;
call('advanceShelfQueue()'); await flush();
assert.equal(audio.dataset.trackId, 'c');
assert.equal(openings, before, 'Auto-next must not reopen a dismissed dialog');
audio.paused = true; audio.ended = true;
call('advanceShelfQueue()');
assert.equal(queue.current(), null);
assert.match(context.message, /SHELF COMPLETE/);
const atEnd = plays;
call('advanceShelfQueue()');
assert.equal(plays, atEnd, 'No implicit repeat at end');
call('playShelf()'); await flush();
owned = ['a', 'c'];
audio.paused = true; audio.ended = true;
call('advanceShelfQueue()'); await flush();
assert.equal(audio.dataset.trackId, 'c', 'Revoked tracks are skipped');
owned = ['a', 'b', 'c'];
call('startTrack(catalog[1])'); await flush();
assert.equal(queue.current(), null, 'Manual playback of another track exits queue');
owned = [];
call('playShelf()');
assert.equal($('#playShelf').disabled, true);
assert.equal(queue.current(), null);
owned = ['a']; mode = 'blocked';
call('playShelf()'); await flush();
assert.equal(queue.current(), 'a', 'Autoplay denial preserves resumable queue');
assert.equal($('#playShelf').textContent, '▶ RESUME SHELF');
mode = 'ok';
call('playShelf()'); await flush();
assert.equal($('#playShelf').textContent, 'Ⅱ PAUSE SHELF');
call('stopShelfQueue()');
assert.equal(queue.current(), null);
audio.pause(); mode = 'pending';
call('startTrack(catalog[0])');
context.appShell.hidden = true;
finishPending(); await flush();
assert.ok(audio.paused, 'Delayed play does not leak into Login');
assert.match(app, /audio\.addEventListener\('ended', \(\) => \{ transportState = 'stopped'; advanceShelfQueue\(\); updateHardwareControls\(\); \}\)/);
for (const segment of [app.slice(app.indexOf('  function ejectTape('), app.indexOf('  function buyCurrentTape(')), app.slice(app.indexOf('  function resetLocalData('), app.indexOf("  loginForm.addEventListener")), app.slice(app.indexOf("  $('#logoutButton').addEventListener"), app.indexOf("  document.addEventListener('click', (event)"))]) {
  assert.ok(segment.includes('stopShelfQueue()'), 'Queue cleared on eject/reset/logout');
}
const css = read('css/styles.css');
assert.ok(css.includes('.ritual-dialog[open] .deck-assembly'));
assert.ok(css.includes('@keyframes player-window-in'));
assert.ok(css.indexOf('@media (prefers-reduced-motion: reduce)') > css.indexOf('@keyframes player-window-in'));
assert.ok(read('index.html').includes('id="playShelf"'));
console.log('PASS: Shelf order, pause/resume, auto-next, artwork, dismissed player, finish, revoked tracks, manual switch, empty/error cases, lifecycle and reduced-motion wiring.');
