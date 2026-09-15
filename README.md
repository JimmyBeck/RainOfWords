# 雨落成诗 (Rain of Words)

> 一段 15 秒的水墨老照片文字雨生成艺术实验。密集的乱字与细雨撞上屋檐瓦面后碎裂成水花；被屋檐留下的字顺瓦坡加速滑落，划向右侧留白成诗。

---

## 视觉与核心机制

1. **古典飞檐曲面与连续碰撞判定**
   - 将古典建筑飞檐起翘（反宇向阳）抽象为样条插值曲面 $y = f(x)$。
   - 粒子下落过程中通过局部区间三次缓动插值计算瓦面高度与瞬时切线斜率 $k = f'(x)$，保证碰撞与滑行轨迹 100% 贴合屋檐视觉轮廓。

2. **多层粒子系统与碰撞分流**
   - **细雨线与随机乱字雨**：
     - 下落叠加微幅正弦水平漂移（$x = x_0 + A \sin(\omega t + \phi)$）与微角自旋。
     - 触瓦瞬间碎裂为水花粒子（Splash），沿法线方向反弹受重力散落消散。
   - **诗句字符状态机**：
     - `FALLING`（随雨滴下落） $\to$ `SLIDING`（触檐吸附，沿瓦面切线加速滑行，保留“落檐不强行排齐”的自然微错位） $\to$ `DRIFTING`（离檐划入右侧大面积留白区域，自然吸附排布成行）。

3. **程序化水滴声学合成**
   - 纯原生 Web Audio API 合成，无需加载任何音频文件。点击右上角即可开启水滴落瓦轻微闷响。

---

## 工程结构与模块职责

本项目严格遵循**零构建（Zero-Build）**与**单源配置（Single Source of Truth）**规范：

```text
RainOfWords/
├── index.html                 # 模块化网页入口（轻量 DOM，按序加载依赖）
├── standalone.html            # 独立单文件完整版（零依赖，单文件直接分发演示）
├── sketch.js                  # 交互主循环与渲染流水线（顶部集中声明 CONFIG）
├── rain.js                    # 核心物理与几何引擎（屋檐样条曲面、粒子动力学）
├── sound.js                   # Web Audio API 声学合成器
├── style.css                  # 页面布局、电影感 HUD 与控件样式
├── tools/                     # 自动化与部署工具
│   └── deploy.py              # PocketBay 自动化部署工具（遵循 Zero-Leak 规范）
├── .gitignore                 # 系统临时文件与缓存隔离
└── README.md                  # 技术架构与工程说明
```

---

## 单源参数配置 (CONFIG)

所有可调动效与视觉参数集中在 `sketch.js` 顶部：

```javascript
const CONFIG = {
  baseWidth: 1600,             // 基准逻辑宽度
  baseHeight: 900,             // 基准逻辑高度
  totalDuration: 15.0,         // 完整循环周期 (秒)
  rainDropCount: 95,           // 细雨丝粒子数
  randomCharCount: 48,         // 乱字雨粒子数
  randomCharPool: "城船水山...", // 随机汉字池
  defaultPoem: "小楼一夜听春雨 深巷明朝卖杏花", // 默认诗句
  roofPoints: [...]            // 屋檐样条几何控制点
};
```

修改上述参数后刷新浏览器即可直接生效，无需编译。

---

## 运行与分发

### 1. 模块化工程运行（推荐）
直接在现代浏览器中双击打开 `index.html`，或通过本地静态服务启动：
```bash
python3 -m http.server 8080
```

### 2. 单文件独立分发
若需单文件快速演示或发送给他人，直接发送 `standalone.html` 即可。该文件内嵌全部样式、逻辑与声学合成算法，双击即可满帧运行。

---

## 在线体验
- 线上演示：[https://rain-of-words.pocketbay.app](https://rain-of-words.pocketbay.app)
- 原作创意参考：小红书 景桐《01 Coding 动效练习 - 雨落成诗》
