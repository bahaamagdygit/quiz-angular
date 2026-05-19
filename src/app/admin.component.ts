import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QuizDataService, AdminQuestion } from './quiz-data.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  protected readonly data = inject(QuizDataService);

  // ---- auth gate --------------------------------------------------------
  protected readonly authed = signal(false);
  protected readonly pwInput = signal('');
  protected readonly pwError = signal(false);

  // ---- ui state ---------------------------------------------------------
  protected readonly selectedSectionId = signal<string | null>(null);
  protected readonly newSectionName = signal('');
  protected readonly savedFlash = signal(false);

  protected readonly sections = this.data.sections;
  protected readonly timePerQuestion = this.data.timePerQuestion;

  protected readonly sectionQuestions = computed<AdminQuestion[]>(() => {
    const id = this.selectedSectionId();
    if (!id) return [];
    // depend on questions signal so the list refreshes on edits
    return this.data.questions().filter((q) => q.sectionId === id);
  });

  protected readonly selectedSectionName = computed(
    () =>
      this.data.sections().find((s) => s.id === this.selectedSectionId())
        ?.name ?? '',
  );

  protected login(): void {
    if (this.data.checkPassword(this.pwInput())) {
      this.authed.set(true);
      this.pwError.set(false);
      const first = this.data.sections()[0];
      if (first) this.selectedSectionId.set(first.id);
    } else {
      this.pwError.set(true);
    }
  }

  protected flash(): void {
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 1200);
  }

  // ---- sections ---------------------------------------------------------
  protected addSection(): void {
    const name = this.newSectionName().trim();
    if (!name) return;
    this.data.addSection(name);
    this.newSectionName.set('');
    const created = this.data
      .sections()
      .find((s) => s.name === name);
    if (created) this.selectedSectionId.set(created.id);
    this.flash();
  }

  protected renameSection(id: string, value: string): void {
    this.data.renameSection(id, value);
    this.flash();
  }

  protected deleteSection(id: string): void {
    if (!confirm('Delete this section and ALL its questions?')) return;
    this.data.deleteSection(id);
    if (this.selectedSectionId() === id) {
      this.selectedSectionId.set(this.data.sections()[0]?.id ?? null);
    }
  }

  protected moveSection(id: string, dir: -1 | 1): void {
    this.data.moveSection(id, dir);
  }

  // ---- questions --------------------------------------------------------
  protected addQuestion(): void {
    const sid = this.selectedSectionId();
    if (sid) {
      this.data.addQuestion(sid);
      this.flash();
    }
  }

  protected patch(
    id: string,
    key: keyof AdminQuestion,
    value: string,
  ): void {
    this.data.updateQuestion(id, { [key]: value } as Partial<AdminQuestion>);
  }

  protected deleteQuestion(id: string): void {
    if (!confirm('Delete this question?')) return;
    this.data.deleteQuestion(id);
  }

  protected moveQuestion(id: string, dir: -1 | 1): void {
    this.data.moveQuestion(id, dir);
  }

  // ---- settings ---------------------------------------------------------
  protected saveTime(value: string): void {
    this.data.setTimePerQuestion(Number(value));
    this.flash();
  }

  protected savePassword(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.data.setPassword(v);
    this.flash();
  }

  protected resetAll(): void {
    if (
      confirm(
        'Reset everything back to the original 112 questions? This erases all your changes.',
      )
    ) {
      this.data.resetToSeed();
      this.selectedSectionId.set(this.data.sections()[0]?.id ?? null);
    }
  }
}
