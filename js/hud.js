// HUD：准星、血量、弹药、击杀播报、伤害闪屏、结算界面
const HUD = (function () {
  let deathCb = null, winCb = null;
  let overlayVisible = false, overlayMode = '';
  let roundNum = 1, remaining = 0;
  let streak = 0, streakTimer = null;
  const el = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    el.healthFill = $('health-fill');
    el.healthText = $('health-text');
    el.ammoText = $('ammo-text');
    el.weaponName = $('weapon-name');
    el.reloadIndicator = $('reload-indicator');
    el.reloadRing = document.querySelector('#reload-indicator .reload-ring');
    el.reloadText = $('reload-text');
    el.streakDisplay = $('streak-display');
    el.roundInfo = $('round-info');
    el.killFeed = $('kill-feed');
    el.crosshair = $('crosshair');
    el.scopeOverlay = $('scope-overlay');
    el.hitmarker = $('hitmarker');
    el.damageFlash = $('damage-flash');
    el.overlay = $('overlay');
    el.overlayTitle = $('overlay-title');
    el.overlaySub = $('overlay-sub');
    el.hint = $('hint');

    el.overlay.addEventListener('click', () => {
      if (!overlayVisible) return;
      if (overlayMode === 'death' && deathCb) deathCb();
      else if (overlayMode === 'win' && winCb) winCb();
    });

    setHealth(100);
    refreshWeapon();
  }

  function setDeathCallback(cb) { deathCb = cb; }
  function setWinCallback(cb) { winCb = cb; }

  function setHealth(hp) {
    el.healthFill.style.width = hp + '%';
    el.healthText.textContent = Math.max(0, Math.round(hp));
    el.healthFill.style.background = hp > 60 ? '#3ddc84' : (hp > 30 ? '#ffb020' : '#ff4444');
  }

  function refreshWeapon() {
    const w = WEAPONS.def();
    el.weaponName.textContent = w.name;
    el.ammoText.textContent = w.type === 'melee' ? '∞' : (WEAPONS.ammo() + ' / ' + WEAPONS.reserve());
  }
  function refreshAmmo() { refreshWeapon(); }

  function updateRoundText() {
    el.roundInfo.textContent = '第 ' + roundNum + ' 回合 · 敌人剩余 ' + remaining;
  }
  function setRound(r, count) { roundNum = r; remaining = count; updateRoundText(); }
  function setRemaining(n) { remaining = n; updateRoundText(); }

  function setBloom(b) {
    el.crosshair.style.setProperty('--gap', Math.round(6 + b * 6) + 'px');
  }

  function setReload(progress, timeLeft) {
    const active = progress > 0 && progress < 1;
    el.reloadIndicator.classList.toggle('show', active);
    if (active) {
      const C = 175.93;
      el.reloadRing.style.strokeDashoffset = (C * (1 - progress)).toFixed(2);
      el.reloadText.textContent = timeLeft.toFixed(1);
    }
  }

  function setScope(show) {
    el.scopeOverlay.classList.toggle('show', show);
  }

  function killStreak() {
    streak++;
    clearTimeout(streakTimer);
    streakTimer = setTimeout(() => { streak = 0; hideStreak(); }, 5000); // 5 秒内无击杀则骷髅消失
    renderStreak();
  }

  function renderStreak() {
    el.streakDisplay.innerHTML = '';
    const n = Math.min(streak, 4);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'skull';
      s.textContent = '💀';
      el.streakDisplay.appendChild(s);
    }
    if (streak >= 5) spawnFireworks(); // 五杀：四骷髅绽放出烟花
  }

  function spawnFireworks() {
    const emojis = ['🎆', '🎇', '✨', '🎉', '💥', '🌟'];
    for (let i = 0; i < 24; i++) {
      const f = document.createElement('span');
      f.className = 'firework';
      f.textContent = emojis[i % emojis.length];
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      f.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      f.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 60) + 'px');
      el.streakDisplay.parentNode.appendChild(f);
      setTimeout(() => f.remove(), 950);
    }
  }

  function hideStreak() {
    el.streakDisplay.innerHTML = '';
    document.querySelectorAll('.firework').forEach(f => f.remove());
  }

  function resetStreak() {
    streak = 0;
    clearTimeout(streakTimer);
    hideStreak();
  }

  function hitmarker(isHead, killed) {
    el.hitmarker.classList.remove('show', 'head', 'kill');
    void el.hitmarker.offsetWidth;
    if (isHead) el.hitmarker.classList.add('head');
    if (killed) el.hitmarker.classList.add('kill');
    el.hitmarker.classList.add('show');
    setTimeout(() => el.hitmarker.classList.remove('show'), 120);
  }

  function flashDamage() {
    el.damageFlash.classList.remove('show');
    void el.damageFlash.offsetWidth;
    el.damageFlash.classList.add('show');
    setTimeout(() => el.damageFlash.classList.remove('show'), 180);
  }

  function killFeed(text) {
    const d = document.createElement('div');
    d.textContent = text;
    el.killFeed.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }

  function showOverlay(title, sub) {
    el.overlayTitle.textContent = title;
    el.overlaySub.textContent = sub;
    el.overlay.style.display = 'flex';
    overlayVisible = true;
    el.reloadIndicator.classList.remove('show');
    el.scopeOverlay.classList.remove('show');
    showHint(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function hideOverlay() {
    el.overlay.style.display = 'none';
    overlayVisible = false;
    if (!document.pointerLockElement) showHint(true);
  }
  function isOverlayVisible() { return overlayVisible; }

  function showDeath() { overlayMode = 'death'; showOverlay('你已被击杀', '点击屏幕重新开始本回合'); }
  function showWin(r) { overlayMode = 'win'; showOverlay('回合胜利', '第 ' + r + ' 回合完成 · 点击进入下一回合'); }

  function showHint(show) { el.hint.style.display = show ? 'block' : 'none'; }

  return {
    init, setDeathCallback, setWinCallback,
    setHealth, refreshWeapon, refreshAmmo,
    setRound, setRemaining, setBloom, setReload, setScope,
    killStreak, resetStreak,
    hitmarker, flashDamage, killFeed,
    showDeath, showWin, showOverlay, hideOverlay, isOverlayVisible, showHint,
  };
})();
