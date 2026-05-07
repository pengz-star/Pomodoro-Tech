const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { Timer } = require('./src/timer');
const { sendNotification } = require('./src/notification');

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
      const total = phase === 'break' ? timer.breakDuration : timer.focusDuration;
      mainWindow.webContents.send('timer:tick', remaining, phase, total);
    }
    updateTrayIcon(phase);
  };

  timer.onComplete = (phase) => {
    sendNotification(
      phase === 'focus' ? '专注完成！' : '休息结束',
      phase === 'focus' ? '该休息一下了 🌿' : '准备好开始新一轮专注了吗？'
    );
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:complete', phase);
    }
  };
}

function sendTimerState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:state', state);
  }
}

// ── IPC handlers ──
ipcMain.on('timer:start', () => {
  if (timer.state === 'idle' || timer.state === 'break') {
    timer.start();
    sendTimerState('running');
  } else if (timer.isRunning) {
    timer.pause();
    sendTimerState('paused');
  } else {
    timer.resume();
    sendTimerState('running');
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
