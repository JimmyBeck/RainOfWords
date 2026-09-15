/**
 * sketch.js - 渲染流水线、状态管理与交互主入口
 */

// =============================================================
// 全局统一配置项 (Single Source of Truth)
// 修改以下参数后刷新页面即可直接生效
// =============================================================
const CONFIG = {
  // 画布基准分辨率
  baseWidth: 1600,
  baseHeight: 900,

  // 循环周期（秒）
  totalDuration: 15.0,

  // 粒子数量
  rainDropCount: 95,
  randomCharCount: 48,

  // 随机汉字池
  randomCharPool: "城船水山跳云春寒滴梧琴乱归少空街黄更点花夜风听深巷晓青帘斜池阁烟远落残微冷孤初暮客舟",

  // 预设诗句
  defaultPoem: "小楼一夜听春雨 深巷明朝卖杏花",

  // 古建筑屋檐曲面控制点 (飞檐微翘)
  roofPoints: [
    { x: -60,  y: 320 },
    { x: 100,  y: 375 },
    { x: 260,  y: 435 },
    { x: 440,  y: 500 },
    { x: 600,  y: 555 },
    { x: 740,  y: 595 },
    { x: 840,  y: 610 }, // 瓦面最低洼点
    { x: 915,  y: 600 }, // 飞檐起翘起点
    { x: 980,  y: 552 }, // 檐角最尖端
  ]
};

// =============================================================
// DOM 元素与上下文绑定
// =============================================================
const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage-container");
const timeDisplay = document.getElementById("timeDisplay");
const progressBar = document.getElementById("progressBar");
const btnReplay = document.getElementById("btnReplay");
const btnAudio = document.getElementById("btnAudio");
const poemSelect = document.getElementById("poemSelect");
const customInput = document.getElementById("customInput");

let dpr = 1;
function resize() {
  const rect = stage.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
}
window.addEventListener("resize", resize);
resize();

// =============================================================
// 场景数据与粒子池
// =============================================================
let loopTime = 0;
let lastTs = performance.now();
let poemLines = [];
let splashes = [];
let rainDrops = [];
let randomChars = [];
let poemChars = [];

function updatePoemLines(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) {
    poemLines = [parts[0], parts.slice(1).join("")];
  } else {
    const half = Math.ceil(text.length / 2);
    poemLines = [text.slice(0, half), text.slice(half)];
  }
}
updatePoemLines(CONFIG.defaultPoem);

function triggerSplash(x, y, count = 4) {
  for (let i = 0; i < count; i++) {
    splashes.push(new SplashParticle(x, y));
  }
}

function resetScene() {
  loopTime = 0;
  splashes = [];
  rainDrops = [];
  for (let i = 0; i < CONFIG.rainDropCount; i++) {
    rainDrops.push(new RainStreak(CONFIG));
  }
  randomChars = [];
  for (let i = 0; i < CONFIG.randomCharCount; i++) {
    randomChars.push(new RandomCharParticle(CONFIG));
  }
  poemChars = [];
  let gIdx = 0;
  poemLines.forEach((line, lIdx) => {
    const chars = line.split("");
    chars.forEach((ch, cIdx) => {
      poemChars.push(new PoemCharParticle(ch, lIdx, cIdx, chars.length, gIdx, CONFIG));
      gIdx++;
    });
  });
}

// =============================================================
// 屋檐与老照片背景渲染
// =============================================================
function drawAtmosphere(c) {
  // 1. 底层米灰暖宣纸
  const bgGrad = c.createLinearGradient(0, 0, CONFIG.baseWidth, CONFIG.baseHeight);
  bgGrad.addColorStop(0, "#d5d3ce");
  bgGrad.addColorStop(0.5, "#dedcd7");
  bgGrad.addColorStop(1, "#eae8e4");
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, CONFIG.baseWidth, CONFIG.baseHeight);

  // 2. 左上角阴翳雨云水汽
  const mistGrad = c.createRadialGradient(240, 220, 40, 420, 320, 750);
  mistGrad.addColorStop(0, "rgba(85, 90, 95, 0.18)");
  mistGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.fillStyle = mistGrad;
  c.fillRect(0, 0, CONFIG.baseWidth, CONFIG.baseHeight);

  // 3. 右侧大面积留白区域极简空境过渡
  const blankGrad = c.createLinearGradient(CONFIG.baseWidth * 0.54, 0, CONFIG.baseWidth, 0);
  blankGrad.addColorStop(0, "rgba(234, 232, 228, 0)");
  blankGrad.addColorStop(1, "rgba(234, 232, 228, 0.8)");
  c.fillStyle = blankGrad;
  c.fillRect(CONFIG.baseWidth * 0.54, 0, CONFIG.baseWidth * 0.46, CONFIG.baseHeight);
}

function drawRoof(c) {
  const pts = CONFIG.roofPoints;
  const tip = pts[pts.length - 1];

  c.save();

  // 1. 瓦面顶缘多边形
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let x = pts[0].x; x <= tip.x; x += 6) {
    const info = RoofGeometry.getInfo(x, pts);
    if (info) c.lineTo(x, info.y);
  }
  c.lineTo(tip.x, tip.y);

  // 屋檐下部结构轮廓
  c.lineTo(tip.x - 10, tip.y + 26);
  c.lineTo(840, 642);
  c.lineTo(600, 648);
  c.lineTo(440, 688);
  c.lineTo(300, 720);
  c.lineTo(140, 760);
  c.lineTo(-60, 800);
  c.closePath();

  // 填充深墨色渐变
  const roofGrad = c.createLinearGradient(0, 300, 500, 800);
  roofGrad.addColorStop(0, "#2c2d30");
  roofGrad.addColorStop(0.4, "#1d1e21");
  roofGrad.addColorStop(1, "#121214");
  c.fillStyle = roofGrad;
  c.fill();

  // 2. 瓦垄线条
  c.strokeStyle = "rgba(12, 12, 14, 0.85)";
  c.lineWidth = 3.5;
  c.beginPath();
  for (let i = 0; i < pts.length - 1; i += 2) {
    const p = pts[i];
    c.moveTo(p.x, p.y);
    c.lineTo(p.x - 28, p.y + 115);
  }
  c.stroke();

  // 3. 檐下斗拱柱头剪影
  c.fillStyle = "#18191b";
  c.fillRect(340, 550, 16, 90);
  c.fillRect(520, 590, 16, 75);
  c.fillRect(700, 622, 14, 60);

  // 4. 瓦面顶缘漫反射微光（与碰撞曲面 100% 贴合）
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let x = pts[0].x; x <= tip.x; x += 6) {
    const info = RoofGeometry.getInfo(x, pts);
    if (info) c.lineTo(x, info.y);
  }
  c.strokeStyle = "rgba(230, 230, 230, 0.35)";
  c.lineWidth = 1.5;
  c.stroke();

  // 5. 檐角戗脊小兽剪影
  c.fillStyle = "#1e1f22";
  c.beginPath();
  c.arc(tip.x - 4, tip.y - 3, 6, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

// =============================================================
// 主渲染循环与帧推进
// =============================================================
function tick(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  loopTime += dt;
  if (loopTime >= CONFIG.totalDuration) {
    resetScene();
  }

  // 更新 HUD 时间码与进度条
  const curSec = Math.floor(loopTime);
  const curMilli = Math.floor((loopTime % 1) * 100);
  const strSec = String(curSec).padStart(2, "0");
  const strMil = String(curMilli).padStart(2, "0");
  timeDisplay.textContent = `▶ ${strSec}:${strMil} / 15:00`;
  progressBar.style.width = `${(loopTime / CONFIG.totalDuration) * 100}%`;

  // 视口缩放适配
  const rect = stage.getBoundingClientRect();
  const currentScaleX = (rect.width * dpr) / CONFIG.baseWidth;
  const currentScaleY = (rect.height * dpr) / CONFIG.baseHeight;

  ctx.save();
  ctx.scale(currentScaleX, currentScaleY);

  // 1. 大气与水墨老照片背景
  drawAtmosphere(ctx);

  // 2. 细雨丝更新与绘制
  for (let r of rainDrops) {
    r.update(CONFIG.roofPoints, (x, y) => triggerSplash(x, y, 1));
    r.draw(ctx);
  }

  // 3. 乱字雨更新与绘制
  for (let rc of randomChars) {
    rc.update(loopTime, CONFIG.roofPoints, (x, y) => {
      triggerSplash(x, y, 4);
      window.soundEngine.playDrip(0.9);
    });
    rc.draw(ctx);
  }

  // 4. 水花溅散更新与绘制
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i];
    s.update();
    s.draw(ctx);
    if (s.life <= 0) {
      splashes.splice(i, 1);
    }
  }

  // 5. 黑白老照片屋檐
  drawRoof(ctx);

  // 6. 诗句字符（触檐、滑落、右侧留白成诗）
  for (let p of poemChars) {
    p.update(loopTime, CONFIG.roofPoints, (x, y) => {
      triggerSplash(x, y, 5);
      window.soundEngine.playDrip(1.1);
    });
    p.draw(ctx);
  }

  ctx.restore();

  requestAnimationFrame(tick);
}

// =============================================================
// 交互事件绑定
// =============================================================
btnAudio.addEventListener("click", () => {
  const isEnabled = window.soundEngine.toggle();
  btnAudio.textContent = isEnabled ? "声音: 开" : "声音: 关";
});

poemSelect.addEventListener("change", (e) => {
  if (e.target.value === "custom") {
    customInput.style.display = "inline-block";
    customInput.focus();
  } else {
    customInput.style.display = "none";
    updatePoemLines(e.target.value);
    resetScene();
  }
});

customInput.addEventListener("change", (e) => {
  if (e.target.value.trim()) {
    updatePoemLines(e.target.value);
    resetScene();
  }
});

btnReplay.addEventListener("click", () => {
  resetScene();
});

canvas.addEventListener("pointerdown", (e) => {
  const rect = stage.getBoundingClientRect();
  const clickX = ((e.clientX - rect.left) / rect.width) * CONFIG.baseWidth;
  const clickY = ((e.clientY - rect.top) / rect.height) * CONFIG.baseHeight;
  triggerSplash(clickX, clickY, 10);
  window.soundEngine.playDrip(1.2);
});

// 启动场景与动画
resetScene();
requestAnimationFrame(tick);
