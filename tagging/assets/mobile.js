(() => {
  const video = document.querySelector('#video');
  const transport = document.querySelector('.transport-buttons');
  const back = document.createElement('button'), forward = document.createElement('button');
  for (const [button, label, offset] of [[back, '−1s', -1], [forward, '+1s', 1]]) {
    button.type = 'button'; button.className = 'icon-btn phone-second'; button.textContent = label;
    button.setAttribute('aria-label', offset < 0 ? 'Back one second' : 'Forward one second');
    button.onclick = () => { video.pause(); video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + offset)); };
  }
  const menu = document.createElement('details'); menu.className = 'phone-settings';
  const summary = document.createElement('summary'); summary.textContent = '☰'; summary.setAttribute('aria-label', 'Settings, reviewer, export and help');
  const panel = document.createElement('div'); panel.className = 'phone-settings-panel';
  const note = document.createElement('p'); note.id = 'phoneNote'; note.textContent = 'W11 · A7 — Choose team, drill and player. Tags save on this device; export Backup JSON after tagging.';
  const more = document.createElement('div'); more.className = 'phone-frame-controls';
  const caption = document.createElement('span'); caption.textContent = 'Frame stepping'; more.append(caption);
  menu.append(summary, panel);
  const header = document.querySelector('header');
  const savedButtons = [...document.querySelector('.marker-actions').children].map(button => [button, button.innerHTML]);
  let restores = [], mounted = false, observer;
  function move(node, parent) { const anchor = document.createComment('phone-layout-position'); node.before(anchor); restores.push(() => anchor.replaceWith(node)); parent.append(node); }
  function updateTimes() {
    for (const [id, textId, label] of [['setStart', 'segStart', 'Start'], ['setEnd', 'segEnd', 'End']]) {
      const button = document.getElementById(id), value = document.getElementById(textId).textContent;
      button.textContent = label + ' · ' + value; button.setAttribute('aria-label', 'Set ' + label.toLowerCase() + ', selected time ' + value);
    }
  }
  function mount() {
    if (mounted) return; mounted = true; document.body.classList.add('compact-phone');
    move(document.querySelector('.clip-select-wrap'), header); header.append(menu);
    move(document.querySelector('.top-actions'), panel); panel.append(note, more);
    move(document.querySelector('#frameBack'), more); move(document.querySelector('#frameFwd'), more); move(document.querySelector('.help'), panel);
    transport.prepend(back); document.querySelector('#playBtn').after(forward); updateTimes();
    observer = new MutationObserver(updateTimes); observer.observe(document.querySelector('.segment'), {childList:true, subtree:true});
  }
  function unmount() {
    if (!mounted) return; observer.disconnect(); restores.reverse().forEach(restore => restore()); restores = [];
    back.remove(); forward.remove(); menu.remove(); savedButtons.forEach(([button, html]) => { button.innerHTML = html; button.removeAttribute('aria-label'); });
    document.body.classList.remove('compact-phone'); mounted = false;
  }
  const phone = matchMedia('(max-width:700px)');
  function apply() { if (phone.matches) mount(); else unmount(); }
  phone.addEventListener('change', apply); apply();
})();
