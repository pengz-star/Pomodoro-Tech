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
      this._emitTick();
      if (this.onComplete) this.onComplete(prevPhase);
      this._startInterval();
    } else if (this._phase === 'break') {
      this._phase = 'idle';
      this._remaining = this.focusDuration;
      this._emitTick();
      if (this.onComplete) this.onComplete('break');
    }
  }

  _emitTick() {
    if (this.onTick) this.onTick(this._remaining, this._phase);
  }
}

module.exports = { Timer };
