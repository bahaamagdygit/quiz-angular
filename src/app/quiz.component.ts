import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TimerComponent } from './timer.component';
import { QuizDataService, AdminQuestion } from './quiz-data.service';

type OptionKey = 'optionA' | 'optionB' | 'optionC' | 'optionD';

interface OptionView {
  id: string;
  key: OptionKey;
  label: string;
}

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [TimerComponent, RouterLink],
  templateUrl: './quiz.component.html',
})
export class QuizComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly data = inject(QuizDataService);

  /** 'picker' = choosing sections, 'playing' = quiz running. */
  protected readonly phase = signal<'picker' | 'playing'>('picker');

  protected readonly sections = this.data.sections;
  protected readonly timePerQuestion = this.data.timePerQuestion;

  /** Section ids ticked on the picker screen. */
  protected readonly chosen = signal<Set<string>>(new Set());

  private deck: AdminQuestion[] = [];
  protected total = 0;

  protected readonly questionNumber = signal(1);
  protected readonly playerScore = signal(0);
  protected readonly wrongAttempt = signal(0);

  /** Bumped on every new question to auto-reset the timer. */
  protected readonly timerKey = signal(0);

  private indexNumber = 0;
  protected readonly current = signal<AdminQuestion | null>(null);
  protected readonly selected = signal<OptionKey | null>(null);
  protected readonly optionColors = signal<Record<string, string>>({});
  protected readonly answered = signal(false);

  protected readonly showInfoPopup = signal(false);
  protected readonly showScoreModal = signal(false);
  protected readonly showOptionModal = signal(false);
  protected readonly showImageModal = signal(false);
  protected readonly modalImageSrc = signal('');
  protected readonly modalImageAlt = signal('');

  protected readonly musicPlaying = signal(true);
  protected readonly remark = signal('');
  protected readonly remarkColor = signal('');

  protected readonly options = computed<OptionView[]>(() => {
    const q = this.current();
    if (!q) return [];
    const all: OptionView[] = [
      { id: 'option-one-label', key: 'optionA', label: q.optionA },
      { id: 'option-two-label', key: 'optionB', label: q.optionB },
      { id: 'option-three-label', key: 'optionC', label: q.optionC },
      { id: 'option-four-label', key: 'optionD', label: q.optionD },
    ];
    // Hide blank C/D so true/false style questions look right.
    return all.filter((o) => o.label.trim() !== '');
  });

  protected readonly questionHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.current()?.question ?? ''),
  );

  protected readonly gradePercentage = computed(() =>
    this.total ? Math.round((this.playerScore() / this.total) * 100) : 0,
  );

  // ---- picker -----------------------------------------------------------
  protected toggleSection(id: string): void {
    this.chosen.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected isChosen(id: string): boolean {
    return this.chosen().has(id);
  }

  protected selectAll(): void {
    this.chosen.set(new Set(this.sections().map((s) => s.id)));
  }

  protected clearAll(): void {
    this.chosen.set(new Set());
  }

  protected sectionCount(id: string): number {
    return this.data
      .questions()
      .filter(
        (q) =>
          q.sectionId === id &&
          q.question.trim() &&
          q.optionA.trim() &&
          q.optionB.trim(),
      ).length;
  }

  protected startQuiz(): void {
    const ids = [...this.chosen()];
    if (ids.length === 0) return;
    this.deck = this.data.buildDeck(ids);
    if (this.deck.length === 0) return;
    this.total = this.deck.length;
    this.indexNumber = 0;
    this.questionNumber.set(1);
    this.playerScore.set(0);
    this.wrongAttempt.set(0);
    this.loadQuestion(0);
    this.phase.set('playing');
  }

  protected backToPicker(): void {
    this.phase.set('picker');
    this.showScoreModal.set(false);
  }

  // ---- quiz flow --------------------------------------------------------
  private loadQuestion(index: number): void {
    this.current.set(this.deck[index]);
    this.selected.set(null);
    this.optionColors.set({});
    this.answered.set(false);
    this.timerKey.update((k) => k + 1); // auto-resets + starts timer
  }

  protected selectOption(key: OptionKey): void {
    if (this.answered()) return;
    this.selected.set(key);
  }

  private checkForAnswer(): void {
    const q = this.current();
    if (!q) return;
    const answer = q.correctOption;
    const choice = this.selected();
    const correctId = this.options().find((o) => o.key === answer)?.id;

    if (choice === null) {
      this.showOptionModal.set(true);
      return;
    }

    this.answered.set(true);
    if (choice === answer) {
      this.optionColors.update((c) => ({ ...c, [correctId!]: 'green' }));
      this.playSound('audio/good.mp3');
      this.playerScore.update((s) => s + 1);
    } else {
      const wrongId = this.options().find((o) => o.key === choice)?.id;
      this.optionColors.update((c) => ({
        ...c,
        [wrongId!]: 'red',
        [correctId!]: 'green',
      }));
      this.playSound('audio/bad.mp3');
      this.wrongAttempt.update((w) => w + 1);
    }
    this.indexNumber++;
    setTimeout(() => this.questionNumber.update((n) => n + 1), 1000);
  }

  protected handleNextQuestion(): void {
    const hadSelection = this.selected() !== null;
    if (!this.answered()) {
      this.checkForAnswer();
      if (!hadSelection) return; // option modal shown, stay
    }

    setTimeout(() => {
      if (this.indexNumber < this.total) {
        this.loadQuestion(this.indexNumber);
      } else {
        this.handleEndGame();
      }
    }, 1000);
  }

  /** Time ran out: mark wrong, reveal the answer, auto-advance. */
  protected onTimeUp(): void {
    if (this.answered()) return;
    this.playSound('audio/bad.mp3');
    const q = this.current();
    const correctId = this.options().find(
      (o) => o.key === q?.correctOption,
    )?.id;
    this.answered.set(true);
    this.wrongAttempt.update((w) => w + 1);
    if (correctId) {
      this.optionColors.update((c) => ({ ...c, [correctId]: 'green' }));
    }
    this.indexNumber++;
    setTimeout(() => {
      this.questionNumber.update((n) => n + 1);
      if (this.indexNumber < this.total) {
        this.loadQuestion(this.indexNumber);
      } else {
        this.handleEndGame();
      }
    }, 1500);
  }

  private handleEndGame(): void {
    const pct = this.gradePercentage();
    let remark = '';
    let color = '';
    if (pct < 50) {
      remark = 'Bad Grades, Keep Practicing.';
      color = '#ef4444';
    } else if (pct < 80) {
      remark = 'Average Grades, You can do better.';
      color = '#f59e0b';
    } else {
      remark = 'Excellent, Keep the good work going.';
      color = '#22c55e';
    }
    this.remark.set(remark);
    this.remarkColor.set(color);
    this.showScoreModal.set(true);
  }

  protected closeScoreModal(): void {
    this.phase.set('picker');
    this.showScoreModal.set(false);
  }

  protected closeOptionModal(): void {
    this.showOptionModal.set(false);
  }

  protected toggleMusic(): void {
    this.musicPlaying.update((p) => !p);
  }

  protected onQuestionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      this.modalImageSrc.set(img.src);
      this.modalImageAlt.set(img.alt);
      this.showImageModal.set(true);
    }
  }

  protected closeImageModal(): void {
    this.showImageModal.set(false);
  }

  private playSound(src: string): void {
    new Audio(src).play().catch(() => {
      /* autoplay may be blocked until user interacts */
    });
  }
}
