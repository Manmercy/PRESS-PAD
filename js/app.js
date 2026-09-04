(() => {
  'use strict';

  const catalog = window.PRESSPAD_CATALOG;
  const artists = window.PRESSPAD_ARTISTS;
  const dailyTrack = catalog.find((track) => track.id === 'login-screen-memories');
  const defaultShelf = ['login-screen-memories', 'fairy-forest', 'angel-shrine', 'quest-log-after-dark', 'pixel-tavern', 'lionfall'];
  const collection = window.createPresspadCollection(localStorage, catalog.map((track) => track.id), defaultShelf);
  const shelfCalendar = window.createPresspadCalendar(collection, catalog);
  const shelfQueue = window.createPresspadShelfQueue();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const entryScreen = $('#entryScreen');
  const bootScreen = $('#bootScreen');
  const appShell = $('#appShell');
  const loginForm = $('#loginForm');
  const entryMusic = $('#entryMusic');
  const entryMusicToggle = $('#entryMusicToggle');
  const audio = $('#audioEngine');
  const globalPlayer = $('#globalPlayer');
  const ritualDialog = $('#ritualDialog');
  const caseScene = $('#caseScene');
  const ritualAction = $('#ritualAction');
  const playingActions = $('#playingActions');
  const skipRitual = $('#skipRitual');
  const toast = $('#toast');

  let currentTrack = dailyTrack;
  let ritualTrack = dailyTrack;
  let ritualIsDaily = false;
  let ritualTimers = [];
  let walletCents = 0;
  let shelfIds = readShelf();
  let receivedDaily = shelfIds.includes(dailyTrack.id);
  let toastTimer;
  let entryMusicEnabled = true;
  let entryMusicState = 'ready';
  let playbackRequest = 0;

  function readShelf() {
    try {
      const saved = collection.read();
      walletCents = saved.balanceCents;
      return saved.shelfIds;
    } catch {
      walletCents = 0;
      return [];
    }
  }

  function refreshAccount() {
    shelfIds = readShelf();
    receivedDaily = shelfIds.includes(dailyTrack.id);
    $('#walletBalance').textContent = `$${(walletCents / 100).toFixed(2)}`;
  }

  function canPlay(track) {
    refreshAccount();
    if (track && shelfIds.includes(track.id)) return true;
    showToast('BUY THIS TAPE FOR $1.00 BEFORE LISTENING.');
    return false;
  }

  function refreshPurchaseState() {
    const owned = shelfIds.includes(ritualTrack.id);
    const sealed = caseScene.classList.contains('state-sealed');
    const playing = caseScene.classList.contains('state-playing');
    $('#buyTape').hidden = owned;
    $('#buyTape').disabled = walletCents < 100;
    $('#buyTape').textContent = walletCents < 100 ? 'NOT ENOUGH DEMO CREDIT' : 'BUY TAPE · $1.00';
    $('#purchaseNote').textContent = owned ? 'IN YOUR SHELF · READY TO PLAY' : `Buy to unlock playback · Wallet $${(walletCents / 100).toFixed(2)} · Demo credits`;
    $('#keepTape').textContent = 'IN YOUR SHELF ✓';
    ritualAction.hidden = playing || (!owned && !sealed);
    if (!owned && !sealed) $('#ritualInstruction').textContent = 'THIS TAPE IS WAITING FOR YOU.';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function playSfx(kind = 'click') {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      const settings = {
        boot: [440, 660, .32], open: [210, 280, .12], slide: [130, 90, .14],
        insert: [90, 52, .18], play: [520, 620, .08], eject: [95, 180, .15], keep: [620, 880, .2], click: [380, 420, .05],
      }[kind] || [380, 420, .05];
      oscillator.type = kind === 'boot' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(settings[0], context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(settings[1], context.currentTime + settings[2]);
      gain.gain.setValueAtTime(.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + settings[2]);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + settings[2]);
      oscillator.addEventListener('ended', () => context.close());
    } catch {
      // Audio feedback is optional; music playback remains available.
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function updateEntryMusicButton() {
    const isPlaying = !entryMusic.paused;
    entryMusicToggle.textContent = isPlaying ? 'BGM / ON' : !entryMusicEnabled ? 'BGM / OFF' : entryMusicState === 'error' ? 'BGM / RETRY' : 'BGM / AUTO';
    entryMusicToggle.setAttribute('aria-pressed', String(isPlaying));
    entryMusicToggle.title = entryMusicState === 'error' ? 'Music could not load. Tap to retry.' : entryMusicState === 'blocked' ? 'Your browser requires a tap before playing sound.' : isPlaying ? 'Turn off login music' : 'Play login music';
  }

  async function startEntryMusic() {
    if (!entryMusicEnabled || entryScreen.hidden || !entryMusic.paused) return;
    try {
      await entryMusic.play();
      // A pending play request must not leak music into Home or undo BGM / OFF.
      if (!entryMusicEnabled || entryScreen.hidden) entryMusic.pause();
      entryMusicState = 'ready';
    } catch (error) {
      if (error.name !== 'AbortError' && entryMusic.paused) {
        entryMusicState = error.name === 'NotAllowedError' ? 'blocked' : 'error';
      }
    }
    updateEntryMusicButton();
  }

  function retryEntryMusicOnGesture(event) {
    if (event.target.closest?.('#entryMusicToggle') || event.isTrusted === false) return;
    if (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey || ['Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
    startEntryMusic();
  }

  function handleEntryMusicPlay() {
    if (!entryMusicEnabled || entryScreen.hidden) entryMusic.pause();
    else entryMusicState = 'ready';
    updateEntryMusicButton();
  }

  function activateApp() {
    $('#sessionName').textContent = loginForm.elements.user.value.trim() || 'SIGNAL_GUEST';
    entryMusic.pause();
    updateEntryMusicButton();
    entryScreen.hidden = true;
    bootScreen.hidden = false;
    playSfx('boot');
    setTimeout(() => { $('#bootMessage').textContent = 'MOUNTING MUSIC ARCHIVE'; }, 650);
    setTimeout(() => { $('#bootMessage').textContent = 'SIGNAL CHANNEL READY'; }, 1300);
    setTimeout(() => {
      bootScreen.hidden = true;
      appShell.hidden = false;
      setView('home');
    }, reduceMotion ? 100 : 2100);
  }

  function setView(view) {
    const pages = $$('.view');
    if (!pages.some((page) => page.dataset.page === view)) return;
    pages.forEach((page) => page.classList.toggle('is-active', page.dataset.page === view));
    $$('.primary-nav [data-view], .mobile-nav [data-view], .settings-link').forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const heading = $(`[data-page="${view}"] h1`);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (view === 'shelf') renderShelf();
    if (view === 'radio') updateRadio();
  }

  function attachCoverFallback(img, track) {
    const frame = img.parentElement;
    const oldCopy = $('.fallback-copy', frame);
    if (oldCopy) oldCopy.remove();
    frame.classList.remove('cover-fallback');
    img.hidden = false;

    const showFallback = () => {
      img.hidden = true;
      frame.classList.add('cover-fallback');
      frame.style.setProperty('--cover-color', track.palette);
      if (!$('.fallback-copy', frame)) {
        const copy = document.createElement('span');
        copy.className = 'fallback-copy';
        copy.innerHTML = `<small>${escapeHtml(track.artist)}</small><strong>${escapeHtml(track.title)}</strong><i>COMMON PRESS / ARTWORK SIGNAL PENDING</i>`;
        frame.append(copy);
      }
    };

    img.onerror = showFallback;
    img.onload = () => {
      img.hidden = false;
      frame.classList.remove('cover-fallback');
      $('.fallback-copy', frame)?.remove();
    };
    queueMicrotask(() => {
      if (img.complete && img.naturalWidth === 0) showFallback();
    });
  }

  function renderDiscover() {
    const featured = dailyTrack;
    $('#featuredRelease').innerHTML = `
      <div class="featured-cover-wrap"><div class="featured-cover-frame"><img class="featured-cover" src="${featured.cover}" alt="Cover artwork for ${escapeHtml(featured.title)}" /></div></div>
      <div class="featured-info"><p class="kicker">STAFF PICK / NEW MUSIC</p><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.genre)}. A quiet transmission from the blue room, made from the memory of machines waking before their users.</p><div class="credit-line"><button data-artist="${escapeHtml(featured.artist)}">Music by ${escapeHtml(featured.artist)} ↗</button><span>Illustration by ${escapeHtml(featured.illustrator)}</span></div><div class="edition-pills"><span>COMMON PRESS · $1.00</span><span>DEMO CREDITS</span><span>${featured.duration}</span></div><button class="primary-button" data-play-track="${featured.id}"><span>${shelfIds.includes(featured.id) ? 'OPEN TAPE' : 'BUY TAPE · $1.00'}</span><span>→</span></button></div>`;
    attachCoverFallback($('.featured-cover'), featured);

    $('#releaseGrid').innerHTML = catalog.map((track) => `
      <button class="release-card" data-play-track="${track.id}" aria-label="Open ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}">
        <span class="cover-frame" style="--cover-color:${track.palette}"><img src="${track.cover}" alt="Cover artwork for ${escapeHtml(track.title)}" loading="lazy" decoding="async" /></span>
        <span class="card-edition"><span>${shelfIds.includes(track.id) ? 'IN YOUR SHELF' : 'BUY TAPE · $1.00'}</span><span>${track.duration}</span></span>
        <h3>${escapeHtml(track.title)}</h3><p>${escapeHtml(track.artist)}</p><p class="illustrator">Illustration by ${escapeHtml(track.illustrator)}</p>
      </button>`).join('');
    $$('.release-card').forEach((card) => {
      const track = catalog.find((item) => item.id === card.dataset.playTrack);
      attachCoverFallback($('img', card), track);
    });

    $('#artistStrip').innerHTML = artists.map((artist, index) => `
      <button class="artist-button" data-artist="${escapeHtml(artist.name)}" style="--artist-color:${artist.color}"><i></i><strong>${String(index + 1).padStart(2, '0')} / ${escapeHtml(artist.name)}</strong><small>${escapeHtml(artist.genre.split(' / ')[0])}</small></button>`).join('');
  }

  function renderRadioHistory() {
    const broadcasts = [...(window.PRESSPAD_BROADCASTS || [])]
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(Date.parse(`${entry.date}T12:00:00Z`)) && new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0, 10) === entry.date && catalog.some((track) => track.id === entry.trackId))
      .sort((a, b) => b.date.localeCompare(a.date));
    $('#radioHistory').innerHTML = broadcasts.map((entry) => {
      const track = catalog.find((item) => item.id === entry.trackId);
      const date = new Date(`${entry.date}T12:00:00Z`);
      const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
      const weekday = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
      const owned = shelfIds.includes(track.id);
      return `<tr class="broadcast-row" role="row" data-play-track="${track.id}">
        <td class="broadcast-date" role="cell"><time datetime="${entry.date}"><strong>${day}</strong><span>${date.getUTCFullYear()} · ${weekday}</span></time></td>
        <td class="broadcast-cover-cell" role="cell"><span class="history-cover" style="--cover-color:${track.palette}"><img src="${track.cover}" alt="${escapeHtml(track.title)} cover" loading="lazy" decoding="async" width="72" height="90" /></span></td>
        <td class="broadcast-detail" role="cell"><button class="broadcast-open" data-play-track="${track.id}" aria-label="Open ${escapeHtml(track.title)}, broadcast ${day} ${date.getUTCFullYear()}">${escapeHtml(track.title)} <span aria-hidden="true">↗</span></button><p>${escapeHtml(track.artist)}</p><small>${escapeHtml(track.genre)} · ${track.duration}</small><span class="broadcast-ownership ${owned ? 'is-owned' : ''}">${owned ? 'IN YOUR SHELF ✓' : 'BUY TAPE · $1.00'}</span></td>
      </tr>`;
    }).join('') || '<tr role="row"><td role="cell" colspan="3" class="broadcast-empty">No past broadcasts yet.</td></tr>';
    $$('.broadcast-row').forEach((item) => {
      const track = catalog.find((entry) => entry.id === item.dataset.playTrack);
      attachCoverFallback($('img', item), track);
    });
  }

  function updateRadio() {
    $('#radioStatus').textContent = receivedDaily ? 'TAPE RECEIVED / ARCHIVED.' : '1 TAPE AVAILABLE.';
    $('#receiveButton').querySelector('span').textContent = receivedDaily ? 'OPEN TODAY\'S TAPE' : 'RECEIVE';
    $('#sealedPackage').classList.toggle('is-received', receivedDaily);
    renderRadioHistory();
  }

  function renderShelf() {
    const tracks = shelfIds.map((id) => catalog.find((track) => track.id === id)).filter(Boolean);
    $('#shelfCount').textContent = `${String(tracks.length).padStart(2, '0')} TAPES`;
    $('#tapeShelf').innerHTML = tracks.length ? tracks.map((track) => `
      <button class="shelf-tape" style="--spine-color:${track.spineColor}" data-play-track="${track.id}" aria-label="Select ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}" title="${escapeHtml(track.title)} — ${escapeHtml(track.artist)}">
        <img class="shelf-backdrop" src="${track.cover}" alt="" aria-hidden="true" loading="lazy" />
        <span class="shelf-thumb" aria-hidden="true"><img src="${track.cover}" alt="" loading="lazy" /></span>
        <span class="shelf-spine"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></span>
        <small class="shelf-number" aria-hidden="true">${String(track.trackNumber).padStart(2, '0')} <span>COM</span></small>
      </button>`).join('') : '<p class="shelf-empty">Your shelf is empty. Find your first tape in Discover.</p>';
    $$('.shelf-tape').forEach((tape) => {
      const track = catalog.find((entry) => entry.id === tape.dataset.playTrack);
      attachCoverFallback($('.shelf-thumb img', tape), track);
      const backdrop = $('.shelf-backdrop', tape);
      backdrop.onerror = () => { backdrop.hidden = true; };
      if (backdrop.complete && backdrop.naturalWidth === 0) backdrop.hidden = true;
    });

    shelfCalendar.render();
    updateShelfPlayButton();
  }

  function openArtist(name) {
    const artist = artists.find((item) => item.name === name);
    const tracks = catalog.filter((track) => track.artist === name);
    if (!artist) return;
    $('#artistGenre').textContent = artist.genre;
    $('#artistName').textContent = artist.name;
    $('#artistBio').textContent = artist.bio;
    $('#artistTracks').innerHTML = `<div class="artist-track-list">${tracks.map((track) => `<button data-play-track="${track.id}"><span class="artist-cover" style="--cover-color:${track.palette}"><img src="${track.cover}" alt="" /></span><strong>${escapeHtml(track.title)}</strong><span>${track.duration} · ▶</span></button>`).join('')}</div>`;
    $$('#artistTracks img').forEach((img, index) => attachCoverFallback(img, tracks[index]));
    $('#artistDialog').showModal();
  }

  function clearRitualTimers() {
    ritualTimers.forEach(clearTimeout);
    ritualTimers = [];
  }

  function setRitualState(state, instruction) {
    caseScene.className = `case-scene state-${state}`;
    ritualDialog.dataset.ritualState = state;
    $('#playingArtwork').hidden = state !== 'playing';
    $('#ritualInstruction').textContent = instruction;
  }

  function setRitualButton(label) {
    ritualAction.querySelector('span').textContent = label;
  }

  function openRitual(track, daily = false, initialState = null) {
    clearRitualTimers();
    refreshAccount();
    ritualTrack = track;
    ritualIsDaily = daily;
    $('#ritualTrackTitle').textContent = track.title;
    const ritualCover = $('#ritualCover');
    ritualCover.alt = `Cover artwork for ${track.title}`;
    ritualCover.onerror = null;
    ritualCover.src = track.cover;
    attachCoverFallback(ritualCover, track);
    const playingCover = $('#playingCover');
    playingCover.onerror = null;
    playingCover.src = track.cover;
    playingCover.alt = `Cover artwork for ${track.title}`;
    attachCoverFallback(playingCover, track);
    $('#playingCoverTitle').textContent = track.title;
    $('#playingCoverArtist').textContent = track.artist;
    const cassetteArt = $('#cassetteArt');
    cassetteArt.hidden = false;
    cassetteArt.onerror = () => { cassetteArt.hidden = true; };
    cassetteArt.src = track.cover;
    $('#ritualCassette').style.setProperty('--tape-color', track.palette);
    $('#ritualCredit').textContent = `Music by ${track.artist} · Illustration by ${track.illustrator}`;
    $('#cassetteTitle').textContent = track.title;
    skipRitual.hidden = true;
    const owned = shelfIds.includes(track.id);
    const state = initialState === 'playing' && !owned ? 'cover' : initialState || (daily && !receivedDaily ? 'sealed' : 'cover');
    if (!owned) audio.pause();
    const instructions = {
      sealed: 'TODAY\'S TAPE IS SEALED.',
      cover: 'CLICK THE COVER TO OPEN THE CASE.',
      playing: 'MEDIA LOCKED. PLAYBACK ACTIVE.',
    };
    playingActions.hidden = state !== 'playing';
    ritualAction.hidden = state === 'playing';
    setRitualState(state, instructions[state] || instructions.cover);
    setRitualButton(state === 'sealed' ? 'REVEAL COVER' : 'OPEN CASE');
    refreshPurchaseState();
    $('#ritualLabel').textContent = daily ? 'DAILY BROADCAST / 003' : 'TAPE SELECTED / COMMON PRESS';
    if (!ritualDialog.open) ritualDialog.showModal();
    updatePlayer();
  }

  function beginInsertion() {
    if (!canPlay(ritualTrack)) { refreshPurchaseState(); return; }
    clearRitualTimers();
    ritualAction.hidden = true;
    skipRitual.hidden = false;
    setRitualState('open', 'CASE OPEN. TAPE DETECTED.');
    playSfx('open');
    if (reduceMotion) return completeInsertion();
    ritualTimers.push(setTimeout(() => { setRitualState('slide', 'SLIDING TAPE FROM PACKAGE.'); playSfx('slide'); }, 850));
    ritualTimers.push(setTimeout(() => { setRitualState('insert', 'INSERTING MEDIA.'); playSfx('insert'); }, 1700));
    ritualTimers.push(setTimeout(completeInsertion, 2700));
  }

  function completeInsertion() {
    clearRitualTimers();
    if (!canPlay(ritualTrack)) { openRitual(ritualTrack); return; }
    setRitualState('playing', 'MEDIA LOCKED. PLAYBACK ACTIVE.');
    skipRitual.hidden = true;
    ritualAction.hidden = true;
    playingActions.hidden = false;
    startTrack(ritualTrack);
  }

  function startTrack(track) {
    if (!canPlay(track)) return;
    if (shelfQueue.current() && shelfQueue.current() !== track.id) stopShelfQueue();
    const request = ++playbackRequest;
    currentTrack = track;
    if (audio.dataset.trackId !== track.id) {
      audio.src = track.audio;
      audio.dataset.trackId = track.id;
    }
    audio.play().then(() => {
      if (request !== playbackRequest || audio.dataset.trackId !== track.id) return;
      if (appShell.hidden) { audio.pause(); return; }
      playSfx('play');
      updatePlayer(!audio.paused);
    }).catch((error) => {
      if (request !== playbackRequest || error.name === 'AbortError') return;
      updatePlayer(false);
      showToast('PRESS PLAY TO START THE AUDIO SIGNAL.');
    });
    globalPlayer.hidden = false;
    appShell.classList.add('has-player');
    const miniCover = $('#miniCover');
    miniCover.alt = `${track.title} cover`;
    miniCover.onerror = null;
    miniCover.src = track.cover;
    attachCoverFallback(miniCover, track);
    $('#miniTitle').textContent = track.title;
    $('#miniArtist').textContent = track.artist;
  }

  function updatePlayer(isPlaying = !audio.paused) {
    ritualDialog.classList.toggle('is-audio-playing', isPlaying && currentTrack.id === ritualTrack.id);
    $('#globalPlay span').textContent = isPlaying ? 'Ⅱ' : '▶';
    $('#globalPlay').setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    $('#ritualPlay span:first-child').textContent = isPlaying ? 'PAUSE' : 'PLAY';
    $('#ritualPlay span:last-child').textContent = isPlaying ? 'Ⅱ' : '▶';
    updateShelfPlayButton();
  }

  function updateShelfPlayButton() {
    const queue = shelfQueue.read();
    const active = Boolean(shelfQueue.current());
    const playing = active && !audio.paused && !audio.ended;
    $('#playShelf').disabled = shelfIds.length === 0;
    $('#playShelf').textContent = playing ? 'Ⅱ PAUSE SHELF' : active ? '▶ RESUME SHELF' : '▶ PLAY SHELF';
    $('#playShelf').setAttribute('aria-pressed', String(playing));
    $('#shelfPlayStatus').textContent = active ? `${playing ? 'Playing' : 'Paused'} · ${queue.index + 1} / ${queue.ids.length} · ${currentTrack.title}` : shelfIds.length ? 'Play all your tapes, in shelf order.' : 'Add a tape to your Shelf to start listening.';
    $$('.shelf-tape').forEach(tape => {
      const selected = active && tape.dataset.playTrack === shelfQueue.current();
      tape.classList.toggle('is-queued-current', selected);
      if (selected) tape.setAttribute('aria-current', 'true');
      else tape.removeAttribute('aria-current');
    });
  }

  function stopShelfQueue() {
    shelfQueue.clear();
    playbackRequest++;
    updateShelfPlayButton();
  }

  function playShelf() {
    refreshAccount();
    if (shelfQueue.current() && shelfIds.includes(shelfQueue.current())) {
      togglePlayback(currentTrack);
      return;
    }
    const firstId = shelfQueue.start(shelfIds);
    const track = catalog.find(track => track.id === firstId);
    if (!track) { stopShelfQueue(); showToast('YOUR SHELF IS EMPTY. FIND A TAPE IN DISCOVER.'); return; }
    clearRitualTimers();
    // Start inside the user's click, without an animation timer delaying audio permission.
    if (audio.dataset.trackId === track.id) audio.currentTime = 0;
    openRitual(track, false, 'playing');
    startTrack(track);
    updateShelfPlayButton();
  }

  function advanceShelfQueue() {
    updatePlayer(false);
    if (!shelfQueue.current() || audio.dataset.trackId !== shelfQueue.current()) return;
    refreshAccount();
    const finishedId = currentTrack.id;
    const nextId = shelfQueue.next(shelfIds);
    const track = catalog.find(track => track.id === nextId);
    if (!track) { stopShelfQueue(); showToast('SHELF COMPLETE. ALL TAPES PLAYED.'); return; }
    // Keep a dismissed player dismissed; update artwork only if it shows this queue.
    if (ritualTrack.id === finishedId) {
      clearRitualTimers();
      if (ritualDialog.open) openRitual(track, false, 'playing');
    }
    startTrack(track);
    updateShelfPlayButton();
  }

  function ejectTape() {
    if (!currentTrack) return;
    stopShelfQueue();
    clearRitualTimers();
    audio.pause();
    playSfx('eject');
    if (!ritualDialog.open) openRitual(currentTrack, false, 'playing');
    playingActions.hidden = true;
    setRitualState('eject', 'EJECTING MEDIA.');
    ritualTimers.push(setTimeout(() => {
      setRitualState('cover', 'TAPE EJECTED. CLICK TO INSERT AGAIN.');
      ritualAction.hidden = false;
      setRitualButton('INSERT AGAIN');
    }, reduceMotion ? 20 : 900));
    updatePlayer(false);
  }

  function buyCurrentTape() {
    try {
      const result = collection.buy(ritualTrack.id);
      refreshAccount();
      refreshPurchaseState();
      if (result.status === 'insufficient') { showToast('NOT ENOUGH DEMO CREDIT.'); return; }
      renderDiscover();
      renderShelf();
      updateRadio();
      playSfx('keep');
      showToast(result.status === 'purchased' ? `ADDED TO SHELF — $1.00 · ${ritualTrack.title}` : 'THIS TAPE IS ALREADY IN YOUR SHELF.');
    } catch {
      showToast('COULD NOT SAVE PURCHASE. CHECK LOCAL STORAGE OR RESET LOCAL DATA.');
    }
  }

  function togglePlayback(track) {
    if (!canPlay(track)) { audio.pause(); openRitual(track); return; }
    if (audio.paused || audio.dataset.trackId !== track.id) startTrack(track);
    else audio.pause();
  }

  function receiveDailyTape() {
    try {
      const result = collection.receive(dailyTrack.id);
      refreshAccount();
      renderDiscover();
      renderShelf();
      updateRadio();
      openRitual(dailyTrack, true, result.status === 'received' ? 'sealed' : null);
      if (result.status === 'received') showToast('RADIO TAPE RECEIVED — SAVED IN YOUR SHELF AND DIARY.');
    } catch {
      showToast('COULD NOT SAVE THIS RADIO TAPE. PLEASE TRY AGAIN.');
    }
  }

  function resetLocalData() {
    if (!window.confirm('Reset PRESS//PAD local data? This removes your Shelf, purchases, diary and notes, restores $100 demo credit, and returns to Login. This cannot be undone.')) return;
    try {
      collection.reset();
      stopShelfQueue();
      clearRitualTimers();
      audio.pause();
      entryMusic.pause();
      window.location.reload();
    } catch {
      showToast('COULD NOT RESET LOCAL DATA. CHECK BROWSER STORAGE PERMISSIONS.');
    }
  }

  loginForm.addEventListener('submit', (event) => { event.preventDefault(); activateApp(); });
  entryMusicToggle.addEventListener('click', () => {
    if (entryMusic.paused) {
      entryMusicEnabled = true;
      if (entryMusic.error) entryMusic.load();
      startEntryMusic();
    } else {
      entryMusicEnabled = false;
      entryMusic.pause();
      updateEntryMusicButton();
    }
  });
  // Keep retries available: touch activation may arrive on click, not pointerdown.
  document.addEventListener('click', retryEntryMusicOnGesture);
  document.addEventListener('keydown', retryEntryMusicOnGesture);
  $('#logoutButton').addEventListener('click', () => {
    stopShelfQueue();
    clearRitualTimers();
    if (ritualDialog.open) ritualDialog.close();
    if ($('#artistDialog').open) $('#artistDialog').close();
    audio.pause();
    globalPlayer.hidden = true;
    appShell.classList.remove('has-player');
    appShell.hidden = true;
    entryScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#entryTitle').tabIndex = -1;
    $('#entryTitle').focus({ preventScroll: true });
    startEntryMusic();
  });
  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    const trackButton = event.target.closest('[data-play-track]');
    const artistButton = event.target.closest('[data-artist]');
    if (viewButton) { playSfx('click'); setView(viewButton.dataset.view); }
    if (trackButton) {
      const track = catalog.find((item) => item.id === trackButton.dataset.playTrack);
      if (track) { $('#artistDialog').open && $('#artistDialog').close(); openRitual(track); }
    }
    if (artistButton) openArtist(artistButton.dataset.artist);
  });

  ritualAction.addEventListener('click', () => {
    if (caseScene.classList.contains('state-sealed')) {
      setRitualState('cover', 'COVER SIGNAL REVEALED. CLICK ONCE TO OPEN.');
      setRitualButton('OPEN CASE');
      refreshPurchaseState();
      playSfx('click');
    } else beginInsertion();
  });
  $('.cover-panel').addEventListener('click', () => {
    if (caseScene.classList.contains('state-cover')) beginInsertion();
  });
  skipRitual.addEventListener('click', completeInsertion);
  $('#closeRitual').addEventListener('click', () => { clearRitualTimers(); ritualDialog.close(); });
  ritualDialog.addEventListener('close', clearRitualTimers);
  $('#ritualPlay').addEventListener('click', () => togglePlayback(ritualTrack));
  $('#buyTape').addEventListener('click', buyCurrentTape);
  $('#resetLocalData').addEventListener('click', resetLocalData);
  $('#ritualEject').addEventListener('click', ejectTape);
  $('#globalEject').addEventListener('click', ejectTape);
  $('#globalPlay').addEventListener('click', () => togglePlayback(currentTrack));
  $('#playShelf').addEventListener('click', playShelf);
  $('#openCurrentTrack').addEventListener('click', () => openRitual(currentTrack, false, audio.paused ? 'cover' : 'playing'));
  $('#receiveButton').addEventListener('click', receiveDailyTape);
  $('#closeArtist').addEventListener('click', () => $('#artistDialog').close());

  audio.addEventListener('play', () => {
    if (appShell.hidden) { audio.pause(); return; }
    const track = catalog.find((item) => item.id === audio.dataset.trackId);
    if (!canPlay(track)) { audio.pause(); return; }
    updatePlayer(true);
  });
  audio.addEventListener('pause', () => updatePlayer(false));
  audio.addEventListener('loadedmetadata', () => {
    $('#seekInput').max = String(audio.duration || 100);
    $('#durationTime').textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    $('#seekInput').value = String(audio.currentTime);
    $('#currentTime').textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('ended', advanceShelfQueue);
  audio.addEventListener('error', () => {
    stopShelfQueue();
    updatePlayer(false);
    showToast('THIS AUDIO FILE COULD NOT LOAD. PLAYBACK STOPPED — TRY PLAY AGAIN.');
  });
  $('#seekInput').addEventListener('input', (event) => { audio.currentTime = Number(event.target.value); });
  $('#volumeInput').addEventListener('input', (event) => { audio.volume = Number(event.target.value) / 100; });
  audio.volume = .7;
  entryMusic.volume = .18;
  entryMusic.addEventListener('play', handleEntryMusicPlay);
  entryMusic.addEventListener('pause', updateEntryMusicButton);
  entryMusic.addEventListener('error', () => { entryMusicState = 'error'; updateEntryMusicButton(); });
  window.addEventListener('pageshow', startEntryMusic);
  window.addEventListener('focus', startEntryMusic);
  startEntryMusic();

  const soraHero = $('.sora-hero');
  soraHero.addEventListener('error', () => {
    if (!soraHero.dataset.fallback) {
      soraHero.dataset.fallback = 'true';
      soraHero.src = './assets/images/sora-rei-reference-fallback.webp';
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== collection.key && event.key !== null) return;
    clearRitualTimers();
    refreshAccount();
    if (!shelfIds.includes(currentTrack.id)) { stopShelfQueue(); audio.pause(); globalPlayer.hidden = true; appShell.classList.remove('has-player'); }
    if (ritualDialog.open) openRitual(ritualTrack, ritualIsDaily);
    renderDiscover(); renderShelf(); updateRadio();
  });
  refreshAccount();
  renderDiscover();
  renderShelf();
  updateRadio();
})();
