/**
 * rain.js - 核心物理与几何引擎
 * 负责古建屋檐样条曲面计算、碰撞判定、水花飞溅粒子系统及文字雨动力学
 */

// 1. 屋檐几何曲面与碰撞插值算法
const RoofGeometry = {
  // 获取特定 X 处的屋檐表面高度 Y 与切线斜率 dydx
  getInfo(x, points) {
    if (!points || x < points[0].x || x > points[points.length - 1].x) {
      return null;
    }
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        // 三次平滑插值，保证瓦面起伏自然连续
        const ease = t * t * (3 - 2 * t);
        const y = p1.y + (p2.y - p1.y) * ease;
        const dydx = (p2.y - p1.y) / (p2.x - p1.x);
        return { y, dydx, index: i };
      }
    }
    return null;
  }
};

// 2. 水花与碎墨粒子
class SplashParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
    const speed = 2.0 + Math.random() * 5.0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.gravity = 0.22;
    this.life = 1.0;
    this.decay = 0.038 + Math.random() * 0.035;
    this.radius = 1.0 + Math.random() * 2.0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life * 0.7);
    ctx.fillStyle = "#222326";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 3. 细雨丝粒子
class RainStreak {
  constructor(config) {
    this.config = config;
    this.reset();
    this.y = Math.random() * config.baseHeight;
  }

  reset() {
    this.x = Math.random() * (this.config.baseWidth * 0.68) - 40;
    this.y = -20 - Math.random() * 120;
    this.length = 18 + Math.random() * 24;
    this.speed = 18 + Math.random() * 12;
    this.alpha = 0.12 + Math.random() * 0.24;
    this.slant = 1.1;
  }

  update(roofPoints, onSplash) {
    this.x += this.slant;
    this.y += this.speed;

    const roof = RoofGeometry.getInfo(this.x, roofPoints);
    if (roof && this.y >= roof.y) {
      if (Math.random() < 0.35 && onSplash) {
        onSplash(this.x, roof.y);
      }
      this.reset();
      return;
    }

    if (this.y > this.config.baseHeight) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = `rgba(32, 33, 35, ${this.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.slant * 2, this.y - this.length);
    ctx.stroke();
    ctx.restore();
  }
}

// 4. 背景乱字雨粒子
class RandomCharParticle {
  constructor(config) {
    this.config = config;
    this.reset();
    this.y = Math.random() * (config.baseHeight * 0.65);
  }

  reset() {
    const chars = this.config.randomCharPool;
    this.char = chars[Math.floor(Math.random() * chars.length)];
    this.x0 = 30 + Math.random() * (this.config.baseWidth * 0.58);
    this.x = this.x0;
    this.y = -40 - Math.random() * 260;
    this.speed = 2.2 + Math.random() * 3.4;
    this.size = 14 + Math.random() * 16;
    this.alpha = 0.22 + Math.random() * 0.42;
    this.wobbleFreq = 1.5 + Math.random() * 2.2;
    this.wobbleAmp = 4 + Math.random() * 10;
    this.rotSpeed = (Math.random() - 0.5) * 0.025;
    this.rotation = (Math.random() - 0.5) * 0.25;
  }

  update(t, roofPoints, onHit) {
    this.y += this.speed;
    this.x = this.x0 + Math.sin(t * this.wobbleFreq + this.y * 0.012) * this.wobbleAmp;
    this.rotation += this.rotSpeed;

    const roof = RoofGeometry.getInfo(this.x, roofPoints);
    if (roof && this.y >= roof.y - 4) {
      if (onHit) onHit(this.x, roof.y);
      this.reset();
      return;
    }

    if (this.y > this.config.baseHeight + 50) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.font = `300 ${this.size}px "Songti SC", "Noto Serif SC", serif`;
    ctx.fillStyle = `rgba(32, 33, 35, ${this.alpha})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.char, 0, 0);
    ctx.restore();
  }
}

// 5. 核心诗句字符状态机 (FALLING -> SLIDING -> DRIFTING)
class PoemCharParticle {
  constructor(char, lineIndex, charIndex, totalInLine, globalIndex, config) {
    this.char = char;
    this.lineIndex = lineIndex;
    this.charIndex = charIndex;
    this.totalInLine = totalInLine;
    this.globalIndex = globalIndex;
    this.config = config;
    this.reset();
  }

  reset() {
    this.state = "FALLING";
    this.spawnTime = 1.0 + this.globalIndex * 0.65;

    // 落点错落分布在屋檐左前段，带自然微抖动（落檐时不强行排齐）
    const targetX = 110 + this.globalIndex * 40 + (Math.random() - 0.5) * 28;
    this.x0 = targetX;
    this.x = this.x0;
    this.y = -60 - (this.globalIndex % 4) * 25;
    this.speed = 3.6;
    this.size = 29;
    this.rotation = (Math.random() - 0.5) * 0.12;
    this.alpha = 0;
    this.targetAlpha = 0.92;

    // 沿瓦面滑行动力学参数
    this.slideVx = 0;
    this.slideOffset = (Math.random() - 0.5) * 5;

    // 右侧留白排布归位目标
    this.driftTargetX = 1060 + this.charIndex * 48;
    this.driftTargetY = 380 + this.lineIndex * 70 + (Math.random() - 0.5) * 4;
  }

  update(t, roofPoints, onLandRoof) {
    if (t < this.spawnTime) return;

    if (this.state === "FALLING") {
      this.alpha = Math.min(this.targetAlpha, this.alpha + 0.05);
      this.y += this.speed;
      this.x = this.x0 + Math.sin(t * 2.2 + this.globalIndex) * 5;
      this.rotation = Math.sin(t * 1.6) * 0.08;

      const roof = RoofGeometry.getInfo(this.x, roofPoints);
      if (roof && this.y >= roof.y - 8) {
        this.state = "SLIDING";
        this.y = roof.y - 6;
        this.slideVx = 1.5;
        if (onLandRoof) onLandRoof(this.x, roof.y);
      }
    } else if (this.state === "SLIDING") {
      const roof = RoofGeometry.getInfo(this.x, roofPoints);
      if (roof) {
        const slopeAccel = Math.max(0.04, roof.dydx * 0.18);
        this.slideVx += slopeAccel;
        this.slideVx = Math.min(this.slideVx, 4.4);
        this.x += this.slideVx;

        const nextRoof = RoofGeometry.getInfo(this.x, roofPoints);
        if (nextRoof) {
          this.y = nextRoof.y - 6 + this.slideOffset;
          this.rotation = Math.atan(nextRoof.dydx) * 0.55;
        } else {
          this.state = "DRIFTING";
        }
      } else {
        this.state = "DRIFTING";
      }
    } else if (this.state === "DRIFTING") {
      const dx = this.driftTargetX - this.x;
      const dy = this.driftTargetY - this.y;
      this.x += dx * 0.038;
      this.y += dy * 0.038;
      this.rotation *= 0.94;

      if (t > this.config.totalDuration - 1.8) {
        this.alpha = Math.max(0, this.alpha - 0.035);
      }
    }
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.font = `600 ${this.size}px "Songti SC", "Noto Serif SC", "STSong", serif`;
    ctx.fillStyle = `rgba(16, 17, 19, ${this.alpha})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = 4;
    ctx.fillText(this.char, 0, 0);

    if (this.state === "SLIDING") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(0, this.size * 0.4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

window.RoofGeometry = RoofGeometry;
window.SplashParticle = SplashParticle;
window.RainStreak = RainStreak;
window.RandomCharParticle = RandomCharParticle;
window.PoemCharParticle = PoemCharParticle;
