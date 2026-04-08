📄 步频节拍器 Web App（MVP）需求文档
1. 项目概述
1.1 项目名称

Cadence Metronome（步频节拍器）

1.2 项目目标

开发一个简单的 Web 节拍器工具，支持用户：

选择步频（BPM）
选择音效（click / beep / clap）
播放 / 暂停节拍
用于跑步或训练时辅助节奏控制

👉 核心定位：极简 + 即开即用 + 无学习成本

2. 功能需求
2.1 MVP 功能（必须实现）
2.1.1 BPM 控制
支持范围：60 – 200 BPM
默认值：120 BPM
调整方式：
Slider（推荐）
或输入框
2.1.2 音效选择

内置 3 种声音：

click（默认）
beep
clap

要求：

切换后立即生效（下一个节拍）
2.1.3 播放控制
Start 按钮
Stop 按钮

行为：

点击 Start → 开始节拍
点击 Stop → 停止节拍
再次 Start → 从当前 BPM 重新开始
2.1.4 节拍播放逻辑

规则：

每个节拍播放一次声音
间隔计算：
interval = 60000 / BPM (毫秒)

例：

120 BPM → 500ms
180 BPM → 333ms
2.1.5 音频行为要求
不允许明显延迟
连续播放不应卡顿
切换声音不会中断节拍循环
2.2 非功能需求
性能
启动播放延迟 < 100ms
节拍误差允许范围：±10ms（MVP）
兼容性
Chrome（必须）
Safari（建议）
移动端浏览器（基本可用）
易用性
页面加载后无需登录
无需任何配置即可使用
3. UI 设计（极简）

页面只需要 3 个区域：

[ BPM 控制 ]

[ 音效选择 ]

[ Start / Stop 按钮 ]

建议增加（可选）：

当前 BPM 显示（大号字体）
节拍闪烁（视觉反馈）
4. 技术方案
4.1 技术选型（最终方案）
前端框架
React + TypeScript
构建工具：Vite

👉 原因：

结构清晰
Vercel 友好
后续扩展容易
音频引擎

使用：

👉 Web Audio API

核心能力：

AudioContext
AudioBuffer
AudioBufferSourceNode

用途：

播放内置音效
控制音频触发
节拍调度

MVP 使用：

setInterval

计算方式：

interval = 60000 / BPM

👉 原因：

简单
足够当前需求

（后期可升级为 Web Audio 精确调度）

静态资源
音频文件存放在：
/public/sounds/

文件：

click.wav
beep.wav
clap.wav
样式
原生 CSS 或 Tailwind（可选）
部署
平台：Vercel
部署方式：GitHub 自动部署
4.2 项目结构
cadence-metronome/
├── public/
│   └── sounds/
│       ├── click.wav
│       ├── beep.wav
│       └── clap.wav
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── BPMControl.tsx
│   │   ├── SoundSelector.tsx
│   │   └── PlayerControls.tsx
│   └── audio/
│       └── metronome.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
4.3 核心模块设计
metronome.ts（核心）

职责：

初始化 AudioContext
加载音频 buffer
控制播放 / 停止
控制 interval

核心逻辑：

let intervalId: number | null = null

function start(bpm: number, buffer: AudioBuffer) {
  const interval = 60000 / bpm

  intervalId = setInterval(() => {
    play(buffer)
  }, interval)
}

function stop() {
  if (intervalId) clearInterval(intervalId)
}
React 状态设计
type State = {
  bpm: number
  isPlaying: boolean
  sound: 'click' | 'beep' | 'clap'
}
5. 开发计划
阶段 1（1～2 小时）
搭建 Vite + React 项目
实现 AudioContext + 播放声音
阶段 2（2～3 小时）
实现 BPM 控制
实现 setInterval 节拍
阶段 3（1～2 小时）
UI 完成
音效切换
Start / Stop

👉 总计：半天内可完成 MVP

6. 风险与注意事项
6.1 Safari 限制
AudioContext 需要用户点击后启动
👉 解决：Start 按钮时初始化
6.2 setInterval 精度问题
长时间运行可能漂移
👉 MVP 可接受
6.3 音频加载延迟
第一次播放可能延迟
👉 解决：页面加载时预加载音频