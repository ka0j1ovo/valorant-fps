# VALORANT-Like · 第一人称战术射击（网页版）

一个用 **Three.js (WebGL)** 写的浏览器 FPS 小游戏，玩法致敬《无畏契约》：
第一人称视角、指针锁定瞄准、命中判定、爆头、后坐力与准星扩散、AI 敌人、回合制。

> 🎮 **在线试玩**：https://ka0j1ovo.github.io/valorant-fps/

## 如何运行

**方式一（最简单）**：双击 `start.bat`
- 如果电脑装了 Python，会自动起一个本地服务器并打开浏览器；
- 否则直接打开 `index.html`。

**方式二**：直接双击 `index.html`，或用任意浏览器打开它。

> 需要联网吗？不需要。Three.js 已本地打包在 `js/three.min.js`，完全离线可玩。

## 操作说明

| 按键 | 功能 |
| --- | --- |
| 鼠标移动 | 视角 |
| 左键 | 射击 |
| WASD / 方向键 | 移动 |
| 空格 | 跳跃 |
| Shift | 静步（移动变慢、更稳） |
| 右键（长按） | 开镜（松开关闭） |
| R | 换弹 |
| 1 / 2 / 3 / 4 / 5 | 切换武器（刀 / 经典 / 幽魂 / 狂徒 / 冥狙） |
| 鼠标滚轮 | 快速切换武器 |
| Esc | 释放鼠标指针 |

## 玩法

- 每回合在地图各处刷新敌人，全部击杀即获胜，进入下一回合（敌人更多、更强）。
- 被击杀后点击屏幕重开本回合。
- 打头伤害翻倍，注意控制后坐力与移动时的准星扩散。

## 项目结构

```
valorant-fps/
├── index.html        入口页面 + HUD 结构
├── style.css         界面样式
├── start.bat         启动脚本
├── README.md
└── js/
    ├── three.min.js   Three.js 库（本地）
    ├── audio.js       Web Audio 程序化音效
    ├── effects.js     弹道 / 枪口火焰 / 血迹 / 火花
    ├── map.js         地图 + 碰撞体 + 爆破点
    ├── weapons.js     武器定义与射击逻辑
    ├── enemy.js       AI 敌人
    ├── player.js      玩家控制与移动
    ├── hud.js         界面更新
    └── main.js        主循环与回合管理
```

## 技术说明

- 纯原生 JS + Three.js，无构建工具，无外部依赖。
- 命中判定用 Three.js `Raycaster`（射线检测），爆头通过区分头部/身体 mesh 实现。
- 音效全部由 Web Audio API 实时合成，无需音频文件。
- 地图纹理为 Canvas 程序化生成，无需贴图资源。
