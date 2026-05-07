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
    const escapedPath = BELL_PATH.replace(/'/g, "''");
    execFile('powershell', [
      '-c',
      `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`
    ], { timeout: 3000 });
  } catch {
    // Silently fail — sound is non-critical
  }
}

module.exports = { sendNotification, playBellSound };
