// 敌人：AI 机器人（寻敌、移动、射击、受击、死亡）
const ENEMIES = (function () {
  let scene = null, camera = null, playerObj = null;
  const list = [];
  let spawnPoints = [];
  let remaining = 0;

  const BOT_NAMES = [
    'slowly', 'Scales', 'Splash', 'Erv', 'SiuFatBB', 'CHICHOO', 'nobody', 'ZmjjKK',
    'Smoggy', 'stew', 'Rarga', 'NoMan', 'Lysoar', 'WsLeo', 'whzy', 'Knight',
    'nephh', 'rushia',
  ];

  function init(sc, cam, player) { scene = sc; camera = cam; playerObj = player; }
  function setSpawnPoints(p) { spawnPoints = p; }

  function clear() {
    list.forEach(e => e.dispose());
    list.length = 0;
  }

  function spawn(count) {
    clear();
    remaining = count;
    // 玩家出生点(0,-24)所在的南侧约30%地图不作为 bot 刷新点
    const filtered = spawnPoints.filter(p => p.z >= -11);
    const pool = filtered.length ? filtered : spawnPoints;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5); // 随机打乱名字
    for (let i = 0; i < count; i++) {
      const sp = shuffled[i % shuffled.length];
      list.push(new Enemy(sp.x + (Math.random() * 3 - 1.5), sp.z + (Math.random() * 3 - 1.5), names[i % names.length]));
    }
  }

  function getMeshes() {
    const out = [];
    for (const e of list) if (e.alive) out.push(e.body, e.head, e.gun);
    return out;
  }
  function getRemaining() { return remaining; }
  function onKill() { remaining = Math.max(0, remaining - 1); HUD.setRemaining(remaining); }

  class Enemy {
    constructor(x, z, name) {
      this.pos = new THREE.Vector3(x, 0, z);
      this.name = name;
      this.hp = 125;
      this.alive = true;
      this.radius = 0.4;
      this.speed = 3.0;
      this.fireCooldown = 0;
      this.reaction = 0.3 + Math.random() * 0.4;
      this.aimError = 90;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0;
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = 0;
      this.deathTimer = 0;
      this.regenTimer = 0; // 脱离战斗回血计时
      this.footstepTimer = 0;
      this.buildMesh();
    }

    buildMesh() {
      this.group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffd900, roughness: 0.5 }); // 亮黄涂装
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffee33, roughness: 0.5 });
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 }); // 黑色描边

      this.body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.32), bodyMat);
      this.body.position.y = 0.9;
      this.body.castShadow = true;
      this.body.userData = { type: 'body', enemy: this };
      this.body.add(new THREE.LineSegments(new THREE.EdgesGeometry(this.body.geometry), edgeMat));

      this.head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), headMat);
      this.head.position.y = 1.55;
      this.head.castShadow = true;
      this.head.userData = { type: 'head', enemy: this };
      this.head.add(new THREE.LineSegments(new THREE.EdgesGeometry(this.head.geometry), edgeMat));

      this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.5), gunMat);
      this.gun.position.set(0.28, 0.95, 0.15);
      this.gun.userData = { type: 'body', enemy: this };

      this.group.add(this.body, this.head, this.gun);
      scene.add(this.group);
    }

    dispose() {
      scene.remove(this.group);
      this.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }

    takeDamage(dmg, isHead, dir) {
      if (!this.alive) return false;
      this.hp -= dmg;
      this.regenTimer = 0; // 受击打断回血
      if (this.hp <= 0) {
        this.alive = false;
        this.deathTimer = 1.3;
        this.group.rotation.x = -Math.PI / 2;
        return true;
      }
      return false;
    }

    update(dt) {
      if (!this.alive) {
        if (this.deathTimer > 0) {
          this.deathTimer -= dt;
          this.group.position.y -= dt * 0.5;
          if (this.deathTimer <= 0) this.group.visible = false;
        }
        return;
      }
      if (!playerObj.alive) return;

      const toPlayer = new THREE.Vector3(playerObj.pos.x - this.pos.x, 0, playerObj.pos.z - this.pos.z);
      const dist = toPlayer.length();
      const dirTo = dist > 0.001 ? toPlayer.clone().divideScalar(dist) : new THREE.Vector3(0, 0, 1);
      const hasLOS = hasLineOfSight(this, playerObj);

      this.group.rotation.y = Math.atan2(dirTo.x, dirTo.z);
      this.aimError = hasLOS ? Math.max(0.28, (3.2 - dist * 0.07) * 0.7) : 90; // bot 扩散 -30%

      if (this.fireCooldown > 0) this.fireCooldown -= dt;

      // 开局即快速向玩家推进，遇到掩体自动绕行继续奔向主角
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 0.12 + Math.random() * 0.15; }
      const strafe = new THREE.Vector3(-dirTo.z, 0, dirTo.x).multiplyScalar(this.strafeDir);

      // 未发现玩家时：随机游走（无序移动）
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderAngle += (Math.random() - 0.5) * 2.6;
        this.wanderTimer = 0.4 + Math.random() * 0.9;
      }
      const wander = new THREE.Vector3(Math.sin(this.wanderAngle), 0, Math.cos(this.wanderAngle));

      if (dist > 2.5) {
        const adv = this.navigate(dirTo).clone();
        if (hasLOS) {
          adv.addScaledVector(strafe, 0.6).normalize(); // 交火时无序横向摆动
        } else {
          adv.addScaledVector(wander, 0.85).normalize(); // 未发现玩家时无序移动
        }
        this.move(adv, dt * 1.0);
      } else {
        this.move(strafe, dt * 1.0);
      }

      // 脚步声（近距离低音量）
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0 && dist < 35) {
        this.footstepTimer = 0.35 + Math.random() * 0.3;
        Audio.enemyFootstep();
      }

      if (hasLOS) {
        if (this.reaction > 0) this.reaction -= dt;
        else if (this.fireCooldown <= 0 && dist < 42) this.shoot();
      } else {
        this.reaction = 0.3;
      }

      // 脱离战斗后缓慢回血
      this.regenTimer += dt;
      if (this.regenTimer > 4 && this.hp < 125) {
        this.hp = Math.min(125, this.hp + dt * 8);
      }

      this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    }

    move(dir, dt) {
      const nx = this.pos.x + dir.x * this.speed * dt;
      const nz = this.pos.z + dir.z * this.speed * dt;
      const r = MAP.resolve(nx, nz, this.radius);
      this.pos.x = r.x; this.pos.z = r.z;
    }

    // 沿某方向探测前方障碍：返回被推挤的“堵塞程度”（越大越堵）
    probeBlocked(dir) {
      let total = 0;
      for (const d of [0.8, 1.8, 2.8]) {
        const tx = this.pos.x + dir.x * d;
        const tz = this.pos.z + dir.z * d;
        const r = MAP.resolve(tx, tz, this.radius);
        total += (tx - r.x) * (tx - r.x) + (tz - r.z) * (tz - r.z);
      }
      return total;
    }

    // 在朝向玩家的一圈候选方向里，选“既少堵塞又尽量朝玩家”的方向，实现绕行
    navigate(toward) {
      const baseAngle = Math.atan2(toward.x, toward.z);
      const samples = [0, 18, -18, 36, -36, 54, -54, 72, -72, 90, -90, 110, -110, 130, -130];
      let bestDir = toward, bestScore = -Infinity;
      for (const ang of samples) {
        const a = baseAngle + ang * Math.PI / 180;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const blocked = this.probeBlocked(dir);
        const score = dir.dot(toward) * 3 - blocked;
        if (score > bestScore) { bestScore = score; bestDir = dir; }
      }
      return bestDir;
    }

    shoot() {
      this.fireCooldown = 0.45 + Math.random() * 0.5;
      this.group.updateMatrixWorld(true);
      const muzzle = new THREE.Vector3(0.2, 1.5, 0.2).applyMatrix4(this.group.matrixWorld);
      const target = playerObj.pos.clone();
      const dir = target.sub(muzzle).normalize();
      const err = this.aimError * Math.PI / 180;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir.addScaledVector(right, (Math.random() * 2 - 1) * err)
         .addScaledVector(up, (Math.random() * 2 - 1) * err)
         .normalize();

      const raycaster = new THREE.Raycaster(muzzle, dir, 0.01, 200);
      const hits = raycaster.intersectObjects(MAP.world.shootables.concat([playerObj.hitbox]), false);
      if (hits.length) {
        const h = hits[0];
        if (h.object === playerObj.hitbox) {
          playerObj.takeDamage(3 + Math.random() * 5);
        } else {
          Effects.spark(h.point, h.face ? h.face.normal : null);
        }
        Effects.tracer(muzzle, h.point);
      } else {
        Effects.tracer(muzzle, muzzle.clone().add(dir.clone().multiplyScalar(200)));
      }
      Effects.muzzleFlash(muzzle);
      Audio.enemyShot();
    }
  }

  function hasLineOfSight(enemy, player) {
    const from = enemy.pos.clone(); from.y = 1.5;
    const to = player.pos.clone(); to.y = 1.5;
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist > 60) return false;
    dir.normalize();
    const raycaster = new THREE.Raycaster(from, dir, 0.1, dist - 0.2);
    return raycaster.intersectObjects(MAP.world.shootables, false).length === 0;
  }

  // 返回距离最近、且玩家可直接看到的存活敌人（供锁头使用）
  function getVisibleEnemy() {
    let best = null, bestDist = Infinity;
    for (const e of list) {
      if (!e.alive || !hasLineOfSight(e, playerObj)) continue;
      const dx = e.pos.x - playerObj.pos.x;
      const dz = e.pos.z - playerObj.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  function update(dt) { list.forEach(e => e.update(dt)); }

  return { init, setSpawnPoints, spawn, clear, getMeshes, getRemaining, onKill, update, getVisibleEnemy, getList: () => list };
})();
