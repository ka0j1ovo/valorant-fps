// 音效：Web Audio 程序化合成（无需外部音频文件）
const Audio = (function () {
  let ctx = null, master = null, noiseBuf = null;
  let streak = 0, streakTimer = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise() {
    const c = ensure(); if (!c) return null;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function noiseBurst(duration, freq, gain, type) {
    const c = ensure(); if (!c) return;
    const buf = noise(); if (!buf) return;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + duration + 0.02);
  }

  function tone(freq, duration, gain, type) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + duration + 0.02);
  }

  function shoot(kind) {
    if (kind === 'pistol') { noiseBurst(0.12, 2200, 0.5); tone(170, 0.08, 0.28); }
    else if (kind === 'rifle') { noiseBurst(0.10, 1800, 0.5); tone(130, 0.07, 0.28); }
    else if (kind === 'smg') { noiseBurst(0.07, 2600, 0.4); tone(230, 0.05, 0.2); }
    else { noiseBurst(0.05, 3000, 0.2); }
  }

  function kill() {
    streak++;
    clearTimeout(streakTimer);
    streakTimer = setTimeout(() => { streak = 0; }, 10000); // 10 秒内无击杀则连杀清零
    const n = Math.min(streak, 5);
    tone([330, 392, 494, 587, 659][n - 1], 0.16, 0.35, 'triangle'); // 连杀音调逐级提高
    if (n === 5) {
      [880, 1046, 1318, 1760].forEach((f, i) => setTimeout(() => tone(f, 0.12, 0.3, 'square'), i * 130)); // 五杀滴滴滴滴
    }
  }

  function resetStreak() {
    streak = 0;
    clearTimeout(streakTimer);
  }

  return {
    resume: ensure,
    shoot,
    kill,
    resetStreak,
    enemyShot() { noiseBurst(0.08, 1500, 0.25); tone(150, 0.06, 0.15); },
    dryfire() { tone(700, 0.05, 0.15); },
    reload() { tone(300, 0.05, 0.2); setTimeout(() => tone(500, 0.05, 0.2), 160); },
    hit() { tone(1200, 0.05, 0.22); },
    headshot() { tone(1800, 0.08, 0.28); },
    enemyDie() { tone(120, 0.4, 0.4, 'sawtooth'); },
    hurt() { noiseBurst(0.2, 800, 0.5); tone(100, 0.2, 0.3, 'sawtooth'); },
    footstep() { noiseBurst(0.06, 500, 0.1); },
    jump() { tone(400, 0.1, 0.1, 'sine'); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.3, 'triangle'), i * 150)); },
    lose() { [400, 300, 200].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.3, 'sawtooth'), i * 200)); },
  };
})();
