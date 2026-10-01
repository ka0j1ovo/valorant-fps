// 主程序：初始化场景、回合管理、主循环
const MAIN = (function () {
  let scene, camera, renderer, clock;
  let round = 1;
  let state = 'playing';
  let time = 0;

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 400);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.id = 'game-canvas';
    document.querySelector('#game-canvas').replaceWith(renderer.domElement);

    Effects.init(scene);
    MAP.build(scene);
    Player.init(scene, camera);
    WEAPONS.init(camera);
    WEAPONS.setPlayer(Player);
    WEAPONS.buildViewModel(camera);
    ENEMIES.init(scene, camera, Player);
    ENEMIES.setSpawnPoints([
      { x: 0, z: 24 }, { x: -10, z: 24 }, { x: 10, z: 24 },
      { x: -20, z: 20 }, { x: 20, z: 20 },
      { x: -16, z: 16 }, { x: 16, z: 16 },
      { x: -8, z: 16 }, { x: 8, z: 16 },
      { x: -20, z: 8 }, { x: 20, z: 8 },
      { x: -12, z: 8 }, { x: 12, z: 8 },
      { x: -24, z: 4 }, { x: 24, z: 4 },
      { x: 0, z: 8 },
    ]);

    HUD.init();
    HUD.setDeathCallback(() => MAIN.restart());
    HUD.setWinCallback(() => MAIN.nextRound());

    startRound(1);

    clock = new THREE.Clock();
    window.addEventListener('resize', onResize);
    animate();
  }

  function startRound(n) {
    round = n;
    state = 'playing';
    const count = Math.min(3 + n, 12); // 每回合敌人 +1
    WEAPONS.resetAmmo();
    ENEMIES.spawn(count);
    Player.respawn();
    HUD.setRound(round, count);
    HUD.resetStreak();
    Audio.resetStreak();
    HUD.hideOverlay();
  }

  function restart() { startRound(round); }   // 死亡重开本回合
  function nextRound() { startRound(round + 1); } // 胜利进入下一回合

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    if (state === 'playing') {
      Player.update(dt);
      ENEMIES.update(dt);
      WEAPONS.update(dt);
      Effects.update(dt);

      const vm = WEAPONS.viewmodel();
      if (vm) {
        vm.visible = !Player.sniperScoped; // 狙击开镜时隐藏枪模型
        const kick = WEAPONS.getViewKick();
        WEAPONS.decayViewKick(dt * 4);
        const bob = (Player.isMoving && Player.grounded) ? Math.sin(time * 11) * 0.004 : 0;
        const centered = Player.ads && WEAPONS.def().id !== 'sniper';
        if (centered) {
          vm.position.set(0, -0.14 + bob, -0.35 + kick * 0.05); // 开镜枪居中
        } else {
          vm.position.set(0.22, -0.18 + bob, -0.45 + kick * 0.06);
        }
        vm.rotation.x = kick * 0.06;
      }

      HUD.setBloom((WEAPONS.getBloom() + (Player.isMoving ? 0.6 : 0)) * (Player.ads ? 0.3 : 1));
      // 换弹 / 狙击退镜装填动画
      const now = performance.now() / 1000;
      const rech = WEAPONS.sniperRechamber(now);
      if (rech < 1) {
        HUD.setReload(rech, (1 - rech) * (60 / WEAPONS.def().rpm));
      } else {
        HUD.setReload(WEAPONS.reloadProgress(), WEAPONS.reloadTimeLeft());
      }

      if (ENEMIES.getRemaining() <= 0) {
        state = 'won';
        HUD.showWin(round);
        Audio.win();
      }
    } else {
      Effects.update(dt);
    }

    renderer.render(scene, camera);
  }

  return { init, restart, nextRound, get state() { return state; } };
})();

MAIN.init();
