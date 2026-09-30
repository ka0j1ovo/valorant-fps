// 玩家：第一人称相机、指针锁定、WASD 移动、跳跃、重力、碰撞、生命值
const Player = (function () {
  let scene = null, camera = null;
  const pos = new THREE.Vector3(0, 1.6, -24);
  const vel = new THREE.Vector3();
  const EYE = 1.6, RADIUS = 0.4;
  let yaw = Math.PI, pitch = 0;
  let hp = 100, alive = true, grounded = true, isMoving = false;
  let hitbox = null;
  let locked = false, mouseDown = false, footstepTimer = 0, lockJustAcquired = false, ads = false;
  const keys = {};

  function init(sc, cam) {
    scene = sc; camera = cam;
    camera.position.copy(pos);
    camera.rotation.order = 'YXZ';

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
    yaw -= mx * 0.0011;
    pitch -= my * 0.0011;
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
    if (e.button === 2) {           // 右键开镜
      if (HUD.isOverlayVisible() || !alive) return;
      if (!locked) lock();
      ads = true;
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
    if (e.button === 2) ads = false;
  }

  function onKeyDown(e) {
    Audio.resume();
    keys[e.code] = true;
    if (e.code === 'KeyR' && alive) WEAPONS.startReload();
    if (e.code === 'Digit1') WEAPONS.switchTo(1);
    if (e.code === 'Digit2') WEAPONS.switchTo(2);
    if (e.code === 'Digit3') WEAPONS.switchTo(3);
    if (e.code === 'Digit4') WEAPONS.switchTo(0);
    if (e.code === 'Space') jump();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function onWheel(e) { if (locked) WEAPONS.cycle(e.deltaY > 0 ? 1 : -1); }

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
    ads = false;
    HUD.setHealth(hp);
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

    // 相机
    camera.position.set(pos.x, pos.y, pos.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch + WEAPONS.getRecoilPitch() * 0.01;
    camera.rotation.z = 0;

    // 开镜缩放（FOV 平滑过渡）
    const targetFov = ads ? 55 : 90;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();

    // 命中盒
    hitbox.position.set(pos.x, pos.y - EYE + 0.85, pos.z);
  }

  return {
    init, update, takeDamage, respawn,
    pos,
    get hitbox() { return hitbox; },
    get alive() { return alive; },
    get grounded() { return grounded; },
    get isMoving() { return isMoving; },
    get hp() { return hp; },
    get ads() { return ads; },
  };
})();
