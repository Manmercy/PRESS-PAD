(() => {
  'use strict';
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const dateLabel = date => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  function monthDays(year, month) {
    const first = new Date(year, month, 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0, 12).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => dayKey(new Date(year, month, index + 1, 12)))];
  }
  window.PRESSPAD_CALENDAR = { dayKey, monthDays };
  window.createPresspadCalendar = (collection, catalog, root = document) => {
    const $ = selector => root.querySelector(selector);
    const grid = $('#miniCalendar');
    const dialog = $('#diaryDialog');
    const note = $('#diaryNote');
    let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
    let selectedDay = null;
    let savedText = '';
    function render() {
      $('#calendarMonth').textContent = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      try {
        const account = collection.read();
        const today = dayKey(new Date());
        grid.innerHTML = monthDays(month.getFullYear(), month.getMonth()).map(day => {
          if (!day) return '<span aria-hidden="true"></span>';
          const events = account.events.filter(event => event.date === day);
          const purchase = events.some(event => event.type === 'purchase');
          const radio = events.some(event => event.type === 'radio');
          const hasNote = Boolean(account.notes[day]);
          const details = [purchase && 'purchased tapes', radio && 'radio tapes', hasNote && 'personal note'].filter(Boolean).join(', ');
          return `<button class="calendar-day${details ? ' has-entry' : ''}" type="button" data-day="${day}" aria-haspopup="dialog"${day === today ? ' aria-current="date"' : ''} aria-label="${dateLabel(new Date(`${day}T12:00:00`))}${details ? ', ' + details : ', no entries'}"><span>${Number(day.slice(-2))}</span><span class="calendar-markers" aria-hidden="true">${purchase ? '<i class="purchase-dot"></i>' : ''}${radio ? '<i class="radio-dot"></i>' : ''}${hasNote ? '<i class="note-dot"></i>' : ''}</span></button>`;
        }).join('');
        $('#calendarStatus').textContent = 'Choose a date to see your tapes or leave a note.';
      } catch {
        grid.innerHTML = '';
        $('#calendarStatus').textContent = 'Could not read your diary. Check local storage permissions.';
      }
    }
    function openDay(day) {
      try {
        const account = collection.read();
        selectedDay = day;
        savedText = account.notes[day] || '';
        note.value = savedText;
        $('#diaryDate').textContent = dateLabel(new Date(`${day}T12:00:00`));
        const events = account.events.filter(event => event.date === day);
        $('#diaryTracks').innerHTML = events.map(event => {
          const track = catalog.find(track => track.id === event.trackId);
          if (!track) return '';
          return `<article class="diary-track"><img src="${escape(track.cover)}" alt="" /><div><strong>${escape(track.title)}</strong><span>${escape(track.artist)}</span><span>${event.type === 'purchase' ? 'Purchased · $1.00 demo credit' : 'Received from Radio · Free'}</span></div></article>`;
        }).join('') || '<p>No tapes recorded for this date. You can still leave a note.</p>';
        $('#diaryStatus').textContent = '';
        dialog.showModal();
      } catch {
        $('#calendarStatus').textContent = 'Could not open this date. Your saved data has not been changed.';
      }
    }
    function mayClose() {
      return note.value === savedText || window.confirm('Discard your unsaved note?');
    }
    $('#closeDiary').addEventListener('click', () => { if (mayClose()) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (!mayClose()) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      grid.querySelector(`[data-day="${selectedDay}"]`)?.focus({ preventScroll: true });
    });
    grid.addEventListener('click', event => {
      const button = event.target.closest('[data-day]');
      if (button) openDay(button.dataset.day);
    });
    $('#calendarPrevious').addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1, 12); render(); });
    $('#calendarNext').addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12); render(); });
    $('#calendarToday').addEventListener('click', () => {
      const today = new Date();
      month = new Date(today.getFullYear(), today.getMonth(), 1, 12);
      render();
      grid.querySelector(`[data-day="${dayKey(today)}"]`)?.focus({ preventScroll: true });
    });
    $('#diaryForm').addEventListener('submit', event => {
      event.preventDefault();
      try {
        collection.saveNote(selectedDay, note.value, savedText);
        savedText = note.value.trim() ? note.value : '';
        note.value = savedText;
        $('#diaryStatus').textContent = savedText ? 'Note saved.' : 'Note removed.';
        render();
      } catch (error) {
        $('#diaryStatus').textContent = error.message.includes('another tab') ? error.message : 'Could not save. Your text is still here — please try again.';
      }
    });
    return { render };
  };
})();
