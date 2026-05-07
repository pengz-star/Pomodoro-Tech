const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const { Timer } = require('./timer');

describe('Timer', () => {
  before(() => mock.timers.enable({ apis: ['setInterval'] }));
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

    // start() emits an initial tick synchronously
    assert.strictEqual(ticks.length, 1);

    mock.timers.tick(1000);
    assert.strictEqual(timer.remainingSeconds, 9);
    assert.strictEqual(ticks.length, 2);

    mock.timers.tick(2000);
    assert.strictEqual(timer.remainingSeconds, 7);
    assert.strictEqual(ticks.length, 4);
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
