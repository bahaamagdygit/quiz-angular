import {
  Component,
  OnDestroy,
  input,
  output,
  signal,
  effect,
} from '@angular/core';

@Component({
  selector: 'app-timer',
  standalone: true,
  template: `
    <div class="clock">
      <svg viewBox="0 0 220 220">
        <circle shape-rendering="geometricPrecision" cx="110" cy="110" r="96" />
        <circle
          shape-rendering="geometricPrecision"
          class="indicator"
          cx="110"
          cy="110"
          r="96"
          [style.strokeDashoffset]="indicatorOffset()"
        />
      </svg>
      <div class="value-container">
        <span class="minutes">{{ minutes() }}</span>
        :
        <span class="seconds">{{ seconds() }}</span>
      </div>
    </div>

    <div class="buttons-container">
      <i class="fas fa-pause" (click)="pause()"
        ><img src="img/pause.png" alt="pause"
      /></i>
      <i class="fas fa-play" (click)="play()"
        ><img src="img/timer.png" alt="play"
      /></i>
      <i class="fas fa-stop" (click)="stop()"
        ><img src="img/stop.png" alt="stop"
      /></i>
    </div>
  `,
})
export class TimerComponent implements OnDestroy {
  /** Seconds for the countdown (global value from admin settings). */
  readonly duration = input<number>(60);

  /**
   * Increment this from the parent on every new question. Each change
   * resets and auto-starts the countdown.
   */
  readonly resetKey = input<number>(0);

  /** Fires when the countdown reaches zero. */
  readonly timeUp = output<void>();

  private counterValue = 60;
  private total = 60;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastKey = -1;

  protected readonly minutes = signal('01');
  protected readonly seconds = signal('00');
  protected readonly indicatorOffset = signal(0);

  constructor() {
    // Whenever resetKey changes, restart the timer with the current duration
    // and start counting down automatically.
    effect(() => {
      const key = this.resetKey();
      const dur = this.duration();
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.total = dur;
        this.counterValue = dur;
        this.render(this.counterValue);
        this.clear();
        this.play();
      }
    });
  }

  play(): void {
    if (this.intervalId === null && this.counterValue > 0) {
      this.intervalId = setInterval(() => {
        const rest = --this.counterValue;
        this.render(rest);
        if (rest <= 0) {
          this.clear();
          this.timeUp.emit();
        }
      }, 1000);
    }
  }

  pause(): void {
    this.clear();
  }

  stop(): void {
    this.clear();
    this.counterValue = this.total;
    this.render(this.counterValue);
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private render(rest: number): void {
    const safe = Math.max(0, rest);
    this.minutes.set(this.pad(Math.floor(safe / 60)));
    this.seconds.set(this.pad(Math.floor(safe % 60)));
    const ratio = this.total > 0 ? safe / this.total : 0;
    this.indicatorOffset.set(600 - ratio * 600);
  }

  private clear(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
