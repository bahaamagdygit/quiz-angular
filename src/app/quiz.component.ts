import { Component, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TimerComponent } from './timer.component';
import { QUESTIONS, Question } from './questions';

type OptionKey = 'optionA' | 'optionB' | 'optionC' | 'optionD';

interface OptionView {
  id: string;
  key: OptionKey;
  label: string;
}

// Original quiz.js targeted 111 questions, but the dataset has fewer unique
// questions, so the deck length is capped to what's actually available
// (the original while-loop would have spun forever otherwise).
const TOTAL = Math.min(111, QUESTIONS.length);

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [TimerComponent],
  templateUrl: './quiz.component.html',
})
export class QuizComponent {
  protected readonly total = TOTAL;

  private shuffled: Question[] = [];
  private indexNumber = 0;

  protected readonly questionNumber = signal(1);
  protected readonly playerScore = signal(0);
  protected readonly wrongAttempt = signal(0);

  protected readonly current = signal<Question>(QUESTIONS[0]);
  protected readonly selected = signal<OptionKey | null>(null);
  /** Per-option background color after an answer is checked. */
  protected readonly optionColors = signal<Record<string, string>>({});

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
    return [
      { id: 'option-one-label', key: 'optionA', label: q.optionA },
      { id: 'option-two-label', key: 'optionB', label: q.optionB },
      { id: 'option-three-label', key: 'optionC', label: q.optionC },
      { id: 'option-four-label', key: 'optionD', label: q.optionD },
    ];
  });

  protected readonly questionHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.current().question),
  );

  protected readonly gradePercentage = computed(
    () => (this.playerScore() / TOTAL) * 100,
  );

  constructor(private sanitizer: DomSanitizer) {
    this.nextQuestion(0);
  }

  /** Shuffle and fill the deck (port of handleQuestions). */
  private handleQuestions(): void {
    while (this.shuffled.length < TOTAL) {
      const random =
        QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      if (!this.shuffled.includes(random)) {
        this.shuffled.push(random);
      }
    }
  }

  private nextQuestion(index: number): void {
    this.handleQuestions();
    this.current.set(this.shuffled[index]);
    this.selected.set(null);
    this.optionColors.set({});
  }

  protected selectOption(key: OptionKey): void {
    this.selected.set(key);
  }

  /** Port of checkForAnswer. */
  private checkForAnswer(): void {
    const answer = this.current().correctOption;
    const choice = this.selected();
    const correctId = this.options().find((o) => o.key === answer)?.id;

    if (choice === null) {
      this.showOptionModal.set(true);
      return;
    }

    if (choice === answer) {
      this.optionColors.update((c) => ({ ...c, [correctId!]: 'green' }));
      this.playSound('audio/good.mp3');
      this.playerScore.update((s) => s + 1);
      this.indexNumber++;
      setTimeout(() => this.questionNumber.update((n) => n + 1), 1000);
    } else {
      const wrongId = this.options().find((o) => o.key === choice)?.id;
      this.optionColors.update((c) => ({
        ...c,
        [wrongId!]: 'red',
        [correctId!]: 'green',
      }));
      this.playSound('audio/bad.mp3');
      this.wrongAttempt.update((w) => w + 1);
      this.indexNumber++;
      setTimeout(() => this.questionNumber.update((n) => n + 1), 1000);
    }
  }

  /** Port of handleNextQuestion. */
  protected handleNextQuestion(): void {
    const hadSelection = this.selected() !== null;
    this.checkForAnswer();

    if (!hadSelection) {
      return; // option modal shown, stay on the question
    }

    setTimeout(() => {
      if (this.indexNumber < TOTAL) {
        this.nextQuestion(this.indexNumber);
      } else {
        this.handleEndGame();
      }
    }, 1000);
  }

  /** Port of handleEndGame. */
  private handleEndGame(): void {
    const score = this.playerScore();
    let remark = '';
    let color = '';

    if (score <= 50) {
      remark = 'Bad Grades, Keep Practicing.';
      color = 'red';
    } else if (score >= 80 && score < 95) {
      remark = 'Average Grades, You can do better.';
      color = 'orange';
    } else if (score >= 100) {
      remark = 'Excellent, Keep the good work going.';
      color = 'green';
    }

    this.remark.set(remark);
    this.remarkColor.set(color);
    this.showScoreModal.set(true);
  }

  protected closeScoreModal(): void {
    this.questionNumber.set(1);
    this.playerScore.set(0);
    this.wrongAttempt.set(0);
    this.indexNumber = 0;
    this.shuffled = [];
    this.nextQuestion(this.indexNumber);
    this.showScoreModal.set(false);
  }

  protected closeOptionModal(): void {
    this.showOptionModal.set(false);
  }

  protected toggleMusic(): void {
    this.musicPlaying.update((p) => !p);
  }

  /** Opens the zoom modal for an embedded question image. */
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

  protected onTimeUp(): void {
    this.playSound('audio/bad.mp3');
  }

  private playSound(src: string): void {
    new Audio(src).play().catch(() => {
      /* autoplay may be blocked until user interacts */
    });
  }
}
