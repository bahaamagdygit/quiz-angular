import {
  Component,
  OnDestroy,
  output,
  signal,
} from '@angular/core';

const POMO_VALUE = 1 * 60; // seconds — same as original quiz.js

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
        ><img src="img/pause.png" alt=">"
      /></i>
      <i class="fas fa-play" (click)="play()"
        ><img src="img/timer.png" alt=">"
      /></i>
      <i class="fas fa-stop" (click)="stop()"
        ><img src="img/stop.png" alt="||"
      /></i>
    </div>
  `,
})
export class TimerComponent implements OnDestroy {
  /** Fires when the countdown reaches zero. */
  readonly timeUp = output<void>();

  private counterValue = POMO_VALUE;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly minutes = signal(this.pad(Math.floor(POMO_VALUE / 60)));
  protected readonly seconds = signal(this.pad(POMO_VALUE % 60));
  protected readonly indicatorOffset = signal(0);

  play(): void {
    if (this.intervalId === null && this.counterValue > 0) {
      this.intervalId = setInterval(() => {
        const rest = --this.counterValue;
        this.render(rest);
        if (rest === 0) {
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
    this.counterValue = POMO_VALUE;
    this.render(this.counterValue);
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private render(rest: number): void {
    this.minutes.set(this.pad(Math.floor(rest / 60)));
    this.seconds.set(this.pad(Math.floor(rest % 60)));
    this.indicatorOffset.set(600 - (rest / POMO_VALUE) * 600);
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
