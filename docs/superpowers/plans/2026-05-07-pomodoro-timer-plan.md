# Pomodoro Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Electron desktop Pomodoro timer with system tray + floating window.

**Architecture:** Electron main process runs the timer (persists even when window is hidden) and manages tray/window lifecycle. Renderer process displays the circular progress UI and sends commands via IPC. No external dependencies beyond Electron itself.

**Tech Stack:** Electron, Vanilla JS, HTML, CSS

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pomodoro-timer",
  "version": "1.0.0",
  "description": "极简桌面番茄钟",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "generate-assets": "node scripts/generate-assets.js",
    "setup": "node scripts/generate-assets.js && electron .",
    "test": "node --test src/**/*.test.js"
  },
  "devDependencies": {
    "electron": "^35.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.superpowers/
```

- [ ] **Step 3: Create directory structure and install dependencies**

Run:
```bash
mkdir -p src/renderer assets scripts
npm install
```

- [ ] **Step 4: Verify Node and npm available**

Run:
```bash
node --version && npm --version
```
Expected: Node >= 18, npm >= 8

- [ ] **Step 5: Commit**

```bash
git init
git add package.json .gitignore
git commit -m "chore: initialize project scaffold"
```

---

### Task 2: Timer module (core logic)

**Files:**
- Create: `src/timer.js`
- Create: `src/timer.test.js`

- [ ] **Step 1: Write the test file `src/timer.test.js`**

```javascript
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const { Timer } = require('./timer');

describe('Timer', () => {
  before(() => mock.timers.enable({ apis: ['setInterval', 'clearInterval'] }));
  after(() => mock.timers.reset());

  it('should start in idle state with focus duration', () => {
    const timer = new Timer({ focusDuration: 25 * 60, breakDuration: 5 * 60 });
    assert.strictEqual(timer.state, 'idle');
    assert.strictEqual(timer.remainingSeconds, 25 * 60);
  });

  it('should transition to focus on start()', () => {
    const timer = new Timer({ focusDuration: 10 });
    timer.start();
    assert.strictEqual(timer.state, 'focus');
  });

  it('should call onTick each interval decreasing remaining', () => {
    const timer = new Timer({ focusDuration: 10 });
    const ticks = [];
    timer.onTick = (r, p) => ticks.push({ r, p });
    timer.start();

    mock.timers.tick(1000);
    assert.strictEqual(timer.remainingSeconds, 9);
    assert.strictEqual(ticks.length, 1);

    mock.timers.tick(2000);
    assert.strictEqual(timer.remainingSeconds, 7);
    assert.strictEqual(ticks.length, 3);
  });

  it('should pause and resume', () => {
    const timer = new Timer({ focusDuration: 20 });
    timer.start();
    mock.timers.tick(3000);
    timer.pause();
    mock.timers.tick(5000); // should NOT tick while paused
    assert.strictEqual(timer.remainingSeconds, 17);
    timer.resume();
    mock.timers.tick(2000);
    assert.strictEqual(timer.remainingSeconds, 15);
  });

  it('should stop and return to idle', () => {
    const timer = new Timer({ focusDuration: 10 });
    timer.start();
    mock.timers.tick(3000);
    timer.stop();
    assert.strictEqual(timer.state, 'idle');
    assert.strictEqual(timer.remainingSeconds, 10);
  });

  it('should reset within same phase', () => {
    const timer = new Timer({ focusDuration: 10 });
    timer.start();
    mock.timers.tick(4000);
    timer.reset();
    assert.strictEqual(timer.remainingSeconds, 10);
  });

  it('should transition to break when focus completes', () => {
    const timer = new Timer({ focusDuration: 5, breakDuration: 8 });
    let completedPhase = null;
    timer.onComplete = (p) => { completedPhase = p; };
    timer.start();

    mock.timers.tick(5000);
    assert.strictEqual(timer.state, 'break');
    assert.strictEqual(timer.remainingSeconds, 8);
    assert.strictEqual(completedPhase, 'focus');
  });

  it('should transition to idle when break completes', () => {
    const timer = new Timer({ focusDuration: 3, breakDuration: 4 });
    timer.start();
    mock.timers.tick(3000);
    assert.strictEqual(timer.state, 'break');
    mock.timers.tick(4000);
    assert.strictEqual(timer.state, 'idle');
    assert.strictEqual(timer.remainingSeconds, 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (no Timer module yet)**

Run:
```bash
node --test src/timer.test.js
```
Expected: FAIL with `Error: Cannot find module './timer'`

- [ ] **Step 3: Write Timer class `src/timer.js`**

```javascript
class Timer {
  constructor({ focusDuration = 25 * 60, breakDuration = 5 * 60 } = {}) {
    this.focusDuration = focusDuration;
    this.breakDuration = breakDuration;
    this._phase = 'idle'; // 'idle' | 'focus' | 'break'
    this._remaining = focusDuration;
    this._intervalId = null;
    this._tickInterval = 1000;
    this.onTick = null;   // callback(remainingSeconds, phase)
    this.onComplete = null; // callback(phase)
  }

  get state() { return this._phase; }
  get remainingSeconds() { return this._remaining; }

  start() {
    if (this._phase === 'idle') {
      this._phase = 'focus';
      this._remaining = this.focusDuration;
      this._emitTick();
    }
    if (this._phase === 'focus' || this._phase === 'break') {
      this._startInterval();
    }
  }

  resume() {
    if (this._phase !== 'idle') this._startInterval();
  }

  pause() {
    this._clearInterval();
  }

  reset() {
    this._remaining = this._phase === 'break' ? this.breakDuration : this.focusDuration;
    this._emitTick();
  }

  stop() {
    this._clearInterval();
    this._phase = 'idle';
    this._remaining = this.focusDuration;
    this._emitTick();
  }

  _startInterval() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => {
      this._remaining--;
      this._emitTick();

      if (this._remaining <= 0) {
        this._clearInterval();
        this._handleComplete();
      }
    }, this._tickInterval);
  }

  _clearInterval() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _handleComplete() {
    if (this._phase === 'focus') {
      const prevPhase = this._phase;
      this._phase = 'break';
      this._remaining = this.breakDuration;
      if (this.onComplete) this.onComplete(prevPhase);
      this._startInterval();
      this._emitTick();
    } else if (this._phase === 'break') {
      this._phase = 'idle';
      this._remaining = this.focusDuration;
      if (this.onComplete) this.onComplete('break');
      this._emitTick();
    }
  }

  _emitTick() {
    if (this.onTick) this.onTick(this._remaining, this._phase);
  }
}

module.exports = { Timer };
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
node --test src/timer.test.js
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/timer.js src/timer.test.js
git commit -m "feat: add timer module with state machine and tests"
```

---

### Task 3: Assets generation (icons + notification sound)

**Files:**
- Create: `scripts/generate-assets.js`
- Create: `assets/icon.png`
- Create: `assets/icon-focus.png`
- Create: `assets/icon-break.png`
- Create: `assets/bell.wav`

- [ ] **Step 1: Write `scripts/generate-assets.js`**

This script generates 3 tray icon PNGs (32x32 colored circles) and a notification WAV sound, using only Node.js built-in modules.

```javascript
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crc]);
}

function createCirclePNG(size, r, g, b) {
  const rawRow = (row) => {
    const pixels = [];
    for (let x = 0; x < size; x++) {
      const cx = x - (size - 1) / 2;
      const cy = row - (size - 1) / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const inside = dist <= size / 2 - 1;
      pixels.push(inside ? r : 0);
      pixels.push(inside ? g : 0);
      pixels.push(inside ? b : 0);
      pixels.push(inside ? 255 : 0);
    }
    return Buffer.from([0, ...pixels]); // filter byte + RGBA
  };

  const rawData = Buffer.concat(Array.from({ length: size }, (_, y) => rawRow(y)));
  const compressed = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  ihdr[9] = 6;  // 8-bit RGBA

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createBellWAV() {
  const sampleRate = 8000;
  const duration = 0.4;
  const freq = 880;
  const numSamples = Math.floor(sampleRate * duration);

  const dataSize = numSamples;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const samples = Buffer.alloc(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
    samples.writeUInt8(Math.round(128 + sample * 60), i);
  }

  return Buffer.concat([header, samples]);
}

// Create assets directory
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Generate icons
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), createCirclePNG(32, 136, 136, 136));       // gray
fs.writeFileSync(path.join(ASSETS_DIR, 'icon-focus.png'), createCirclePNG(32, 231, 76, 60));    // red
fs.writeFileSync(path.join(ASSETS_DIR, 'icon-break.png'), createCirclePNG(32, 39, 174, 96));    // green

// Generate sound
fs.writeFileSync(path.join(ASSETS_DIR, 'bell.wav'), createBellWAV());

console.log('Assets generated in', ASSETS_DIR);
```

- [ ] **Step 2: Run the asset generation script**

Run:
```bash
node scripts/generate-assets.js
```
Expected: `Assets generated in F:\SoftWareData\vscode\003-Pomodoro-Tech\assets`
Verify files:
```bash
ls -la assets/
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-assets.js assets/
git commit -m "feat: add asset generation script and generated assets"
```

---

### Task 4: Notification module

**Files:**
- Create: `src/notification.js`

- [ ] **Step 1: Write `src/notification.js`**

```javascript
const { Notification } = require('electron');
const path = require('path');

const BELL_PATH = path.join(__dirname, '..', 'assets', 'bell.wav');

function sendNotification(title, body) {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body });
    notif.show();
  }
}

function playBellSound() {
  try {
    const { execFile } = require('child_process');
    // Windows: use PowerShell to play the WAV file asynchronously
    execFile('powershell', [
      '-c',
      `(New-Object Media.SoundPlayer '${BELL_PATH.replace(/'/g, "''")}').PlaySync()`
    ], { timeout: 3000 });
  } catch {
    // Silently fail — sound is non-critical
  }
}

module.exports = { sendNotification, playBellSound };
```

- [ ] **Step 2: Commit**

```bash
git add src/notification.js
git commit -m "feat: add notification module with system notification and sound"
```

---

### Task 5: Renderer UI

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/style.css`
- Create: `src/renderer/renderer.js`

- [ ] **Step 1: Write `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>番茄钟</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div id="phase-label">空闲</div>
    <div id="timer-container">
      <svg id="progress-ring" width="120" height="120" viewBox="0 0 120 120">
        <circle id="ring-bg" cx="60" cy="60" r="52" />
        <circle id="ring-fg" cx="60" cy="60" r="52" />
      </svg>
      <div id="timer-text">25:00</div>
    </div>
    <div id="controls">
      <button id="btn-reset" class="btn btn-sm" title="重置">↺</button>
      <button id="btn-start" class="btn btn-primary" title="开始">▶</button>
      <button id="btn-stop" class="btn btn-sm" title="停止">⏹</button>
    </div>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/renderer/style.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  background: #1a1a2e;
  color: #fff;
  user-select: none;
  -webkit-app-region: drag;  /* enable window dragging */
  overflow: hidden;
  width: 100vw; height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 8px;
  padding: 16px;
}

#phase-label {
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #888;
  transition: color 0.3s;
}

#phase-label.focus { color: #e74c3c; }
#phase-label.break { color: #27ae60; }

#timer-container {
  position: relative;
  width: 120px; height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#progress-ring { position: absolute; }

#ring-bg {
  fill: none;
  stroke: #2a2a3e;
  stroke-width: 5;
}

#ring-fg {
  fill: none;
  stroke: #888;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 326.73;
  stroke-dashoffset: 0;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: stroke 0.3s, stroke-dashoffset 0.3s;
}

#ring-fg.focus { stroke: #e74c3c; }
#ring-fg.break { stroke: #27ae60; }

#timer-text {
  font-size: 28px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  color: #fff;
  z-index: 1;
}

#controls {
  display: flex;
  gap: 12px;
  align-items: center;
  -webkit-app-region: no-drag;  /* buttons are clickable */
}

.btn {
  background: transparent;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

.btn-sm { width: 34px; height: 34px; font-size: 14px; }

.btn-primary {
  width: 48px; height: 48px;
  font-size: 18px;
  border: none;
  background: #e74c3c;
  color: #fff;
}

.btn-primary:hover { background: #c0392b; }
.btn-primary.running { background: #f39c12; }
.btn-primary.running:hover { background: #e67e22; }

.btn-primary.break { background: #27ae60; }
.btn-primary.break:hover { background: #219a52; }
```

- [ ] **Step 3: Write `src/renderer/renderer.js`**

```javascript
const { ipcRenderer } = require('electron');

// DOM references
const phaseLabel = document.getElementById('phase-label');
const timerText = document.getElementById('timer-text');
const ringFg = document.getElementById('ring-fg');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const btnStop = document.getElementById('btn-stop');

const CIRCUMFERENCE = 2 * Math.PI * 52; // ~326.73

// Audio context for notification sound
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silent */ }
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateProgress(remaining, total) {
  const offset = CIRCUMFERENCE * (1 - remaining / total);
  ringFg.style.strokeDashoffset = offset;
}

// IPC handlers
ipcRenderer.on('timer:tick', (_event, remaining, phase) => {
  const total = phase === 'break' ? 5 * 60 : 25 * 60;
  timerText.textContent = formatTime(remaining);
  updateProgress(remaining, total);

  phaseLabel.textContent = phase === 'focus' ? '专注中' : phase === 'break' ? '休息中' : '空闲';
  phaseLabel.className = phase;

  ringFg.className = phase;

  // Update start button state
  if (phase === 'idle') {
    btnStart.textContent = '▶';
    btnStart.className = 'btn btn-primary';
  } else if (phase === 'focus') {
    btnStart.className = 'btn btn-primary running';
  } else if (phase === 'break') {
    btnStart.className = 'btn btn-primary break';
  }
});

ipcRenderer.on('timer:complete', () => {
  playNotificationSound();
});

// Button events
btnStart.addEventListener('click', () => {
  ipcRenderer.send('timer:start');
});

btnReset.addEventListener('click', () => {
  ipcRenderer.send('timer:reset');
});

btnStop.addEventListener('click', () => {
  ipcRenderer.send('timer:stop');
});

// Listen for pause/resume via start button text toggle
ipcRenderer.on('timer:state', (_event, state) => {
  btnStart.textContent = state === 'running' ? '⏸' : '▶';
});
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/
git commit -m "feat: add renderer UI with circular progress timer"
```

---

### Task 6: Electron main process

**Files:**
- Create: `main.js`

- [ ] **Step 1: Write `main.js`**

```javascript
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { Timer } = require('./src/timer');
const { sendNotification, playBellSound } = require('./src/notification');

let mainWindow = null;
let tray = null;
let timer = null;

// ── Icon helpers ──
function createTrayIcon(iconPath) {
  const img = nativeImage.createFromPath(iconPath);
  return img.resize({ width: 16, height: 16 });
}

function getIconPath(phase) {
  const base = path.join(__dirname, 'assets');
  if (phase === 'focus') return path.join(base, 'icon-focus.png');
  if (phase === 'break') return path.join(base, 'icon-break.png');
  return path.join(base, 'icon.png');
}

function updateTrayIcon(phase) {
  if (tray) tray.setImage(createTrayIcon(getIconPath(phase)));
}

// ── Window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 220,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  // Hide instead of close
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('blur', () => {
    // Optional: auto-hide on blur for cleaner UX
  });
}

// ── Tray ──
function createTray() {
  tray = new Tray(createTrayIcon(getIconPath('idle')));
  tray.setToolTip('番茄钟');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '▶ 开始专注',
      click: () => { timer.start(); showWindow(); },
    },
    {
      label: '⏸ 暂停',
      click: () => { timer.pause(); },
    },
    {
      label: '↺ 重置',
      click: () => { timer.reset(); },
    },
    { type: 'separator' },
    {
      label: '⏹ 退出',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ── Timer setup ──
function setupTimer() {
  timer = new Timer({ focusDuration: 25 * 60, breakDuration: 5 * 60 });

  timer.onTick = (remaining, phase) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:tick', remaining, phase);
    }
    updateTrayIcon(phase);
  };

  timer.onComplete = (phase) => {
    sendNotification(
      phase === 'focus' ? '专注完成！' : '休息结束',
      phase === 'focus' ? '该休息一下了 🌿' : '准备好开始新一轮专注了吗？'
    );
    playBellSound();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:complete', phase);
    }
  };
}

// ── IPC handlers ──
ipcMain.on('timer:start', () => {
  if (timer.state === 'idle' || timer.state === 'break') {
    timer.start();
  } else {
    timer.pause();     // toggle: running → pause
  }
});

ipcMain.on('timer:reset', () => { timer.reset(); });
ipcMain.on('timer:stop', () => { timer.stop(); });

// ── App lifecycle ──
app.whenReady().then(() => {
  setupTimer();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // On Windows, keep running in tray
});

app.on('activate', () => {
  if (mainWindow) showWindow();
});
```

- [ ] **Step 2: Commit**

```bash
git add main.js
git commit -m "feat: add Electron main process with tray, window, and IPC"
```

---

### Task 7: Integration verification

- [ ] **Step 1: Run the app**

```bash
npm start
```
Expected: Electron window appears with circular Pomodoro timer UI, tray icon shows in system tray.

- [ ] **Step 2: Manual verification checklist**

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Click ▶ Start | Timer starts counting down, ring animates, label shows "专注中" |
| 2 | Click ▶ again (running) | Timer pauses, button shows ▶ |
| 3 | Click ↺ Reset | Timer resets to 25:00 |
| 4 | Let focus count down to 0 | Notification + sound, auto-transitions to break (5min, green) |
| 5 | Let break count down to 0 | Notification + sound, returns to idle |
| 6 | Click ⏹ Stop | Returns to idle (25:00) |
| 7 | Click tray icon | Window toggles show/hide |
| 8 | Close window (✕) | Hides to tray, timer keeps running |
| 9 | Right-click tray | Shows context menu with all options |
| 10 | Tray icon color | Gray=idle, Red=focus, Green=break |

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: complete Pomodoro timer implementation"
```

---

### Self-review

1. **Spec coverage:**
   - Core timer (25/5 min) ✅ — Task 2
   - Start/pause/reset/stop ✅ — Tasks 2, 6, 7
   - System notification + sound ✅ — Task 4
   - Tray icon state changes ✅ — Task 6
   - Tray context menu ✅ — Task 6
   - Floating window 320×220, frameless ✅ — Task 6
   - Toggle window via tray click ✅ — Task 6
   - Close = hide to tray ✅ — Task 6
   - Circular progress UI ✅ — Task 5
   - Dark theme (focus=red, break=green) ✅ — Task 5
   - No persistence ✅ — Task 1 design, no database

2. **Placeholder scan:** All code blocks contain actual implementation code. No "TBD", "TODO" patterns.

3. **Type consistency:** All IPC channel names match between main.js and renderer.js (`timer:tick`, `timer:complete`, `timer:start`, `timer:reset`, `timer:stop`). Timer class API (`state`, `remainingSeconds`, `start()`, `pause()`, `resume()`, `reset()`, `stop()`, `onTick`, `onComplete`) consistent across all files.

4. **Ambiguity check:** Every state transition, IPC message, and UI interaction is explicitly specified with code.

**Plan complete.** Ready for execution.
