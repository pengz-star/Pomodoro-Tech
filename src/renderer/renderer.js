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
ipcRenderer.on('timer:tick', (_event, remaining, phase, total) => {
  timerText.textContent = formatTime(remaining);
  updateProgress(remaining, total);

  phaseLabel.textContent = phase === 'focus' ? '专注中' : phase === 'break' ? '休息中' : '空闲';
  phaseLabel.className = phase;

  ringFg.className = phase;

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

// Listen for pause/resume state
ipcRenderer.on('timer:state', (_event, state) => {
  btnStart.textContent = state === 'running' ? '⏸' : '▶';
});
