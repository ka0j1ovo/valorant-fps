// 玩家：第一人称相机、指针锁定、WASD 移动、跳跃、重力、碰撞、生命值
const Player = (function () {
  let scene = null, camera = null;
  const pos = new THREE.Vector3(0, 1.6, -24);
  const vel = new THREE.Vector3();
  const EYE = 1.6, RADIUS = 0.4;
  let yaw = Math.PI, pitch = 0;
  let hp = 100, alive = true, grounded = true, isMoving = false;
  let hitbox = null;
  let locked = false, mouseDown = false, footstepTimer = 0, lockJustAcquired = false, ads = false, sniperScoped = false;
  const keys = {};

  function init(sc, cam) {
    scene = sc; camera = cam;
    camera.position.copy(pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw; // 初始朝北，菜单背景可见地图

    hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.7, 0.6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    scene.add(hitbox);

    const canvas = document.querySelector('#game-canvas');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
      if (locked) lockJustAcquired = true; // 标记：忽略锁定瞬间的异常鼠标位移
      if (!locked) ads = false; // 解锁时退出开镜
      if (!locked && !HUD.isOverlayVisible()) HUD.showHint(true);
      else HUD.showHint(false);
    });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('wheel', onWheel);
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  function onMouseMove(e) {
    if (!locked) return;
    if (lockJustAcquired) { lockJustAcquired = false; return; } // 忽略锁定后第一帧的尖峰
    const mx = e.movementX, my = e.movementY;
    if (!Number.isFinite(mx) || !Number.isFinite(my)) return;   // 忽略 NaN
    if (Math.abs(mx) > 300 || Math.abs(my) > 300) return;    // 忽略异常大位移，防视角飞走
    const sens = sniperScoped ? 0.8 : 1; // 狙击开镜灵敏度降低20%
    yaw -= mx * 0.0011 * sens;
    pitch -= my * 0.0011 * sens;
    const lim = 1.55;
    if (pitch > lim) pitch = lim;
    if (pitch < -lim) pitch = -lim;
  }

  function lock() {
    const canvas = document.querySelector('#game-canvas');
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  }

  function onMouseDown(e) {
    Audio.resume();
    if (e.button === 2) {           // 右键开镜（长按或点击，取决于设置）
      if (HUD.isOverlayVisible() || !alive) return;
      if (!locked) lock();
      ads = Settings.getAdsMode() === 'toggle' ? !ads : true;
      return;
    }
    if (e.button !== 0) return;
    if (HUD.isOverlayVisible()) return;
    if (!alive) return;
    if (!locked) { lock(); return; }
    mouseDown = true;
    WEAPONS.tryFire(performance.now() / 1000, true);
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2 && Settings.getAdsMode() === 'hold') ads = false;
  }

  function onKeyDown(e) {
    Audio.resume();
    keys[e.code] = true;
    if (e.code === 'KeyR' && alive) WEAPONS.startReload();
    if (e.code === 'Digit1') { ads = false; WEAPONS.switchTo(1); }
    if (e.code === 'Digit2') { ads = false; WEAPONS.switchTo(2); }
    if (e.code === 'Digit3') { ads = false; WEAPONS.switchTo(3); }
    if (e.code === 'Digit4') { ads = false; WEAPONS.switchTo(0); }
    if (e.code === 'Digit5') { ads = false; WEAPONS.switchTo(4); }
    if (e.code === 'Space') jump();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function onWheel(e) { if (locked) { ads = false; WEAPONS.cycle(e.deltaY > 0 ? 1 : -1); } }

  function jump() {
    if (grounded && alive) {
      vel.y = 6.5; grounded = false; Audio.jump();
    }
  }

  function takeDamage(dmg) {
    if (!alive) return;
    hp = Math.max(0, hp - dmg);
    HUD.setHealth(hp);
    HUD.flashDamage();
    Audio.hurt();
    if (hp <= 0) {
      alive = false;
      HUD.showDeath();
      Audio.lose();
    }
  }

  function respawn() {
    hp = 100; alive = true;
    pos.set(0, EYE, -24);
    vel.set(0, 0, 0);
    yaw = Math.PI; pitch = 0;
    ads = false; sniperScoped = false;
    HUD.setHealth(hp);
  }

  // 锁头：若开启，把准星吸附到最近且可见敌人的头部
  function snapToHead() {
    if (!Settings.getHeadlock()) return;
    const target = ENEMIES.getVisibleEnemy();
    if (!target) return;
    const head = new THREE.Vector3(target.pos.x, 1.55, target.pos.z).sub(pos).normalize();
    yaw = Math.atan2(-head.x, -head.z);
    pitch = Math.asin(Math.max(-1, Math.min(1, head.y)));
    if (pitch > 1.55) pitch = 1.55;
    if (pitch < -1.55) pitch = -1.55;
  }

  function update(dt) {
    const now = performance.now() / 1000;
    let mx = 0, mz = 0;
    if (alive && locked) {
      if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
      if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    }
    const walking = keys['ShiftLeft'] || keys['ShiftRight'];
    let speed = walking ? 3.0 : 5.5;
    if (ads) speed *= 0.6; // 开镜减速
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const wx = cos * mx - sin * mz;
    const wz = -sin * mx - cos * mz;
    vel.x = wx * speed;
    vel.z = wz * speed;
    isMoving = (Math.abs(wx) > 0.001 || Math.abs(wz) > 0.001);

    vel.y -= 30 * dt;
    if (vel.y < -40) vel.y = -40;

    let nx = pos.x + vel.x * dt;
    let nz = pos.z + vel.z * dt;
    const r = MAP.resolve(nx, nz, RADIUS);
    pos.x = r.x; pos.z = r.z;

    pos.y += vel.y * dt;
    if (pos.y <= EYE) { pos.y = EYE; vel.y = 0; grounded = true; }
    else grounded = false;

    if (isMoving && grounded) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) { Audio.footstep(); footstepTimer = walking ? 0.5 : 0.32; }
    }

    // 全自动按住连发
    if (mouseDown && alive && locked && WEAPONS.def().auto) {
      WEAPONS.tryFire(now, true);
    }

    // 开镜缩放状态（先算出来，供锁头与相机使用）
    const w = WEAPONS.def();
    const rechamber = WEAPONS.sniperRechamber(now);
    const isSniper = w.id === 'sniper';
    sniperScoped = isSniper && ads && rechamber >= 1;
    const zoomed = ads && !(isSniper && rechamber < 1); // 狙击装填期间回到一倍视野

    // 锁头：开镜后持续吸附到最近可见敌人头部（正常视角不锁）
    if (alive && zoomed) snapToHead();

    // 相机
    camera.position.set(pos.x, pos.y, pos.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch + WEAPONS.getRecoilPitch() * 0.01;
    camera.rotation.z = 0;

    // 开镜缩放（FOV 平滑过渡）
    const targetFov = zoomed ? (w.adsFov || 55) : 90;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    HUD.setScope(sniperScoped);

    // 命中盒
    hitbox.position.set(pos.x, pos.y - EYE + 0.85, pos.z);
  }

  return {
    init, update, takeDamage, respawn, snapToHead,
    pos,
    get hitbox() { return hitbox; },
    get alive() { return alive; },
    get grounded() { return grounded; },
    get isMoving() { return isMoving; },
    get hp() { return hp; },
    get ads() { return ads; },
    get sniperScoped() { return sniperScoped; },
  };
})();
