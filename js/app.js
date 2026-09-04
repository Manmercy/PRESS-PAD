(() => {
  'use strict';

  const catalog = window.PRESSPAD_CATALOG;
  const artists = window.PRESSPAD_ARTISTS;
  const dailyTrack = catalog.find((track) => track.id === 'login-screen-memories');
  const defaultShelf = ['login-screen-memories', 'fairy-forest', 'angel-shrine', 'quest-log-after-dark', 'pixel-tavern', 'lionfall'];
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
  let shelfIds = readShelf();
  let receivedDaily = localStorage.getItem('presspad-v012-daily') === 'kept';
  let toastTimer;
  let entryMusicEnabled = true;

  function readShelf() {
    try {
      const saved = JSON.parse(localStorage.getItem('presspad-v012-shelf') || 'null');
      return Array.isArray(saved) && saved.length ? saved : defaultShelf;
    } catch {
      return defaultShelf;
    }
  }

  function writeShelf() {
    localStorage.setItem('presspad-v012-shelf', JSON.stringify(shelfIds));
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
    entryMusicToggle.textContent = isPlaying ? 'BGM / ON' : entryMusicEnabled ? 'BGM / START' : 'BGM / OFF';
    entryMusicToggle.setAttribute('aria-pressed', String(isPlaying));
  }

  async function startEntryMusic() {
    if (!entryMusicEnabled || entryScreen.hidden) return;
    try {
      await entryMusic.play();
    } catch {
      // Browsers may require the first pointer interaction before audible playback.
    }
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
    queueMicrotask(() => {
      if (img.complete && img.naturalWidth === 0) showFallback();
    });
  }

  function renderDiscover() {
    const featured = dailyTrack;
    $('#featuredRelease').innerHTML = `
      <div class="featured-cover-wrap"><div class="featured-cover-frame"><img class="featured-cover" src="${featured.cover}" alt="Cover artwork for ${escapeHtml(featured.title)}" /></div></div>
      <div class="featured-info"><p class="kicker">STAFF PICK / NEW MUSIC</p><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.genre)}. A quiet transmission from the blue room, made from the memory of machines waking before their users.</p><div class="credit-line"><button data-artist="${escapeHtml(featured.artist)}">Music by ${escapeHtml(featured.artist)} ↗</button><span>Illustration by ${escapeHtml(featured.illustrator)}</span></div><div class="edition-pills"><span>COMMON PRESS · 29 THB</span><span>RARE PRESS · ${featured.editions.rare.serial}</span><span>${featured.duration}</span></div><button class="primary-button" data-play-track="${featured.id}"><span>OPEN TAPE</span><span>▶</span></button></div>`;
    attachCoverFallback($('.featured-cover'), featured);

    $('#releaseGrid').innerHTML = catalog.map((track) => `
      <button class="release-card" data-play-track="${track.id}" aria-label="Open ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}">
        <span class="cover-frame" style="--cover-color:${track.palette}"><img src="${track.cover}" alt="Cover artwork for ${escapeHtml(track.title)}" /></span>
        <span class="card-edition"><span>COMMON PRESS</span><span>${track.duration}</span></span>
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
    $('#radioHistory').innerHTML = catalog.slice(6, 10).map((track) => `
      <button class="history-item" data-play-track="${track.id}"><span class="history-cover" style="--cover-color:${track.palette}"><img src="${track.cover}" alt="" /></span><div><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span><span>ARCHIVED</span></div></button>`).join('');
    $$('.history-item').forEach((item) => {
      const track = catalog.find((entry) => entry.id === item.dataset.playTrack);
      attachCoverFallback($('img', item), track);
    });
  }

  function updateRadio() {
    $('#radioStatus').textContent = receivedDaily ? 'TAPE RECEIVED / ARCHIVED.' : '1 TAPE AVAILABLE.';
    $('#receiveButton').querySelector('span').textContent = receivedDaily ? 'OPEN TODAY\'S TAPE' : 'RECEIVE';
    $('#sealedPackage').classList.toggle('is-received', receivedDaily);
  }

  function renderShelf() {
    const tracks = shelfIds.map((id) => catalog.find((track) => track.id === id)).filter(Boolean);
    $('#shelfCount').textContent = `${String(tracks.length).padStart(2, '0')} TAPES`;
    $('#tapeShelf').innerHTML = tracks.map((track, index) => `
      <button class="shelf-tape ${index === 2 ? 'rare' : ''}" data-play-track="${track.id}" aria-label="Select ${escapeHtml(track.title)}"><img src="${track.cover}" alt="" /><strong>${escapeHtml(track.title)}</strong><small>${index === 2 ? 'RARE' : 'COMMON'} / ${String(index + 1).padStart(2, '0')}</small></button>`).join('');
    $$('.shelf-tape').forEach((tape) => {
      const track = catalog.find((entry) => entry.id === tape.dataset.playTrack);
      attachCoverFallback($('img', tape), track);
    });

    const keptDays = receivedDaily ? [1, 2, 3, 5, 8, 9, 17, 24, 30] : [1, 2, 5, 8, 9, 17, 24, 30];
    $('#miniCalendar').innerHTML = Array.from({ length: 30 }, (_, index) => index + 1).map((day) => `<span class="${keptDays.includes(day) ? 'kept' : [4, 11, 18].includes(day) ? 'missed' : ''}">${day}</span>`).join('');
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
    $('#ritualInstruction').textContent = instruction;
  }

  function setRitualButton(label) {
    ritualAction.querySelector('span').textContent = label;
  }

  function openRitual(track, daily = false, initialState = null) {
    clearRitualTimers();
    ritualTrack = track;
    ritualIsDaily = daily;
    $('#ritualTrackTitle').textContent = track.title;
    const ritualCover = $('#ritualCover');
    ritualCover.alt = `Cover artwork for ${track.title}`;
    attachCoverFallback(ritualCover, track);
    ritualCover.src = track.cover;
    $('#ritualCredit').textContent = `Music by ${track.artist} · Illustration by ${track.illustrator}`;
    $('#cassetteTitle').textContent = track.title;
    skipRitual.hidden = true;
    const state = initialState || (daily && !receivedDaily ? 'sealed' : 'cover');
    const instructions = {
      sealed: 'TODAY\'S TAPE IS SEALED.',
      cover: 'CLICK THE COVER TO OPEN THE CASE.',
      playing: 'MEDIA LOCKED. PLAYBACK ACTIVE.',
    };
    $('#keepTape').textContent = shelfIds.includes(track.id) ? 'ARCHIVED ✓' : 'KEEP TAPE';
    playingActions.hidden = state !== 'playing';
    ritualAction.hidden = state === 'playing';
    setRitualState(state, instructions[state] || instructions.cover);
    setRitualButton(state === 'sealed' ? 'REVEAL COVER' : 'OPEN CASE');
    $('#ritualLabel').textContent = daily ? 'DAILY BROADCAST / 003' : 'TAPE SELECTED / COMMON PRESS';
    if (!ritualDialog.open) ritualDialog.showModal();
  }

  function beginInsertion() {
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
    setRitualState('playing', 'MEDIA LOCKED. PLAYBACK ACTIVE.');
    skipRitual.hidden = true;
    ritualAction.hidden = true;
    playingActions.hidden = false;
    startTrack(ritualTrack);
  }

  function startTrack(track) {
    currentTrack = track;
    if (audio.dataset.trackId !== track.id) {
      audio.src = track.audio;
      audio.dataset.trackId = track.id;
    }
    audio.play().then(() => {
      playSfx('play');
      updatePlayer(true);
    }).catch(() => {
      updatePlayer(false);
      showToast('PRESS PLAY TO START THE AUDIO SIGNAL.');
    });
    globalPlayer.hidden = false;
    appShell.classList.add('has-player');
    const miniCover = $('#miniCover');
    miniCover.alt = `${track.title} cover`;
    attachCoverFallback(miniCover, track);
    miniCover.src = track.cover;
    $('#miniTitle').textContent = track.title;
    $('#miniArtist').textContent = track.artist;
  }

  function updatePlayer(isPlaying = !audio.paused) {
    $('#globalPlay span').textContent = isPlaying ? 'Ⅱ' : '▶';
    $('#globalPlay').setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    $('#ritualPlay span:first-child').textContent = isPlaying ? 'PAUSE' : 'PLAY';
    $('#ritualPlay span:last-child').textContent = isPlaying ? 'Ⅱ' : '▶';
  }

  function ejectTape() {
    if (!currentTrack) return;
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

  function keepCurrentTape() {
    if (!shelfIds.includes(ritualTrack.id)) shelfIds.push(ritualTrack.id);
    writeShelf();
    if (ritualIsDaily) {
      receivedDaily = true;
      localStorage.setItem('presspad-v012-daily', 'kept');
      updateRadio();
    }
    playSfx('keep');
    renderShelf();
    showToast(`ARCHIVED — ${ritualTrack.title}`);
    $('#keepTape').textContent = 'ARCHIVED ✓';
  }

  loginForm.addEventListener('submit', (event) => { event.preventDefault(); activateApp(); });
  entryMusicToggle.addEventListener('click', () => {
    if (entryMusic.paused) {
      entryMusicEnabled = true;
      startEntryMusic();
    } else {
      entryMusicEnabled = false;
      entryMusic.pause();
      updateEntryMusicButton();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#entryMusicToggle')) startEntryMusic();
  }, { once: true });
  $('#logoutButton').addEventListener('click', () => {
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
      playSfx('click');
    } else beginInsertion();
  });
  $('.cover-panel').addEventListener('click', () => {
    if (caseScene.classList.contains('state-cover')) beginInsertion();
  });
  skipRitual.addEventListener('click', completeInsertion);
  $('#closeRitual').addEventListener('click', () => { clearRitualTimers(); ritualDialog.close(); });
  ritualDialog.addEventListener('close', clearRitualTimers);
  $('#ritualPlay').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('#keepTape').addEventListener('click', keepCurrentTape);
  $('#ritualEject').addEventListener('click', ejectTape);
  $('#globalEject').addEventListener('click', ejectTape);
  $('#globalPlay').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('#openCurrentTrack').addEventListener('click', () => openRitual(currentTrack, false, audio.paused ? 'cover' : 'playing'));
  $('#receiveButton').addEventListener('click', () => openRitual(dailyTrack, true));
  $('#closeArtist').addEventListener('click', () => $('#artistDialog').close());

  audio.addEventListener('play', () => updatePlayer(true));
  audio.addEventListener('pause', () => updatePlayer(false));
  audio.addEventListener('loadedmetadata', () => {
    $('#seekInput').max = String(audio.duration || 100);
    $('#durationTime').textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    $('#seekInput').value = String(audio.currentTime);
    $('#currentTime').textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('ended', () => updatePlayer(false));
  $('#seekInput').addEventListener('input', (event) => { audio.currentTime = Number(event.target.value); });
  $('#volumeInput').addEventListener('input', (event) => { audio.volume = Number(event.target.value) / 100; });
  audio.volume = .7;
  entryMusic.volume = .18;
  entryMusic.addEventListener('play', updateEntryMusicButton);
  entryMusic.addEventListener('pause', updateEntryMusicButton);
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

  renderDiscover();
  renderRadioHistory();
  renderShelf();
  updateRadio();
})();
