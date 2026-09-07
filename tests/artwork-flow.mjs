import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const html = read('index.html');
const css = read('css/styles.css');
const data = { window: {} };
vm.runInNewContext(read('data/catalog.js'), data);
const tracks = data.window.PRESSPAD_CATALOG;
const hashes = new Set();
for (const track of tracks) {
  assert.ok(track.cover.endsWith('.webp'), `Missing finished artwork: ${track.id}`);
  const image = fs.readFileSync(new URL(`../${track.cover}`, import.meta.url));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  hashes.add(createHash('sha256').update(image).digest('hex'));
}
assert.equal(hashes.size, 12, 'Every track must have its own artwork');
assert.ok(html.includes('assets/images/seal-package-v012.webp'));
assert.ok(css.includes('.state-sealed .cover-panel, .state-sealed .case-back { visibility: hidden; }'));
assert.ok(css.includes('.ritual-dialog:not(.is-audio-playing) .reel'));

// Execute actual app handlers with DOM doubles; not a browser/layout test.
const elements = new Map();
function element() {
  return { hidden: false, src: '', textContent: '', dataset: {}, style: { setProperty(name, value) { this[name] = value; } },
    classList: { toggle(name, value) { this[name] = value; }, contains(name) { return Boolean(this[name]); }, add(name) { this[name] = true; }, remove(name) { this[name] = false; } }, setAttribute() {}, querySelector() { return element(); } };
}
const $ = (selector) => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); };
const context = { $, $$: () => [], ritualTrack: null, ritualIsDaily: false, currentTrack: tracks[0],
  $$: () => [], shelfQueue: { read: () => ({ ids: [], index: -1 }), current: () => null },
  clearRitualTimers() {}, attachCoverFallback() {}, setRitualButton() {}, refreshAccount() {}, refreshPurchaseState() {}, updateHardwareControls() {},
  audio: { paused: true, currentTime: 0, dataset: {}, pause() {} }, receivedDaily: false, shelfIds: [], reduceMotion: true, transportState: 'idle',
  caseScene: element(), skipRitual: element(), playingActions: element(), ritualAction: element(),
  ritualDialog: { ...element(), open: false, showModal() { this.open = true; } } };
const state = app.slice(app.indexOf('  function setRitualState('), app.indexOf('  function setRitualButton('));
const open = app.slice(app.indexOf('  function openRitual('), app.indexOf('  function beginInsertion('));
const player = app.slice(app.indexOf('  function updatePlayer('), app.indexOf('  function ejectTape('));
vm.runInNewContext(state + open + player, context);
for (const track of tracks) {
  context.track = track;
  vm.runInNewContext('openRitual(track);', context);
  for (const selector of ['#ritualCover', '#playingCover', '#cassetteArt']) assert.equal($(selector).src, track.cover);
  assert.equal($('#playingCoverTitle').textContent, track.title);
  assert.equal($('#ritualCassette').style['--tape-color'], track.palette);
  assert.equal($('#playingArtwork').hidden, true);
  vm.runInNewContext('setRitualState("playing", "Playing");', context);
  assert.equal($('#playingArtwork').hidden, false);
  vm.runInNewContext('setRitualState("eject", "Ejecting");', context);
  assert.equal($('#playingArtwork').hidden, true);
}
context.track = tracks[0];
vm.runInNewContext('openRitual(track, true);', context);
assert.equal(context.caseScene.className, 'case-scene state-sealed');
context.audio.paused = false;
vm.runInNewContext('updatePlayer();', context);
assert.equal(context.ritualDialog.classList['is-audio-playing'], true);
context.audio.paused = true;
vm.runInNewContext('updatePlayer();', context);
assert.equal(context.ritualDialog.classList['is-audio-playing'], false);
console.log('PASS: 12 distinct covers; shared Discover/player identity; sealed/reveal/play/eject artwork states; reels pause with audio.');
