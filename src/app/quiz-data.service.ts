import { Injectable, computed, signal } from '@angular/core';
import { QUESTIONS, Question } from './questions';

/** A question with a stable id and the section it belongs to. */
export interface AdminQuestion extends Question {
  id: string;
  sectionId: string;
}

export interface Section {
  id: string;
  /** Display name (originally the `infoQuest` value). */
  name: string;
}

export interface QuizData {
  sections: Section[];
  questions: AdminQuestion[];
  /** Global seconds allowed per question. */
  timePerQuestion: number;
  adminPassword: string;
}

const STORAGE_KEY = 'quiz-angular:data:v1';
const DEFAULT_TIME = 60;
const DEFAULT_PASSWORD = 'admin';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Build the initial dataset from the bundled QUESTIONS list. */
function seed(): QuizData {
  const sections: Section[] = [];
  const byName = new Map<string, Section>();

  const questions: AdminQuestion[] = QUESTIONS.map((q) => {
    const name = (q.infoQuest || 'بدون قسم').trim();
    let section = byName.get(name);
    if (!section) {
      section = { id: uid(), name };
      byName.set(name, section);
      sections.push(section);
    }
    return { ...q, id: uid(), sectionId: section.id };
  });

  return {
    sections,
    questions,
    timePerQuestion: DEFAULT_TIME,
    adminPassword: DEFAULT_PASSWORD,
  };
}

@Injectable({ providedIn: 'root' })
export class QuizDataService {
  private readonly _data = signal<QuizData>(this.load());

  readonly sections = computed(() => this._data().sections);
  readonly questions = computed(() => this._data().questions);
  readonly timePerQuestion = computed(() => this._data().timePerQuestion);

  private load(): QuizData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QuizData;
        if (parsed?.sections && parsed?.questions) {
          return {
            ...parsed,
            timePerQuestion: parsed.timePerQuestion ?? DEFAULT_TIME,
            adminPassword: parsed.adminPassword ?? DEFAULT_PASSWORD,
          };
        }
      }
    } catch {
      /* corrupt storage — fall back to seed */
    }
    const fresh = seed();
    this.persist(fresh);
    return fresh;
  }

  private persist(data: QuizData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / unavailable — keep in-memory state */
    }
  }

  private update(mut: (d: QuizData) => QuizData): void {
    const next = mut(this._data());
    this._data.set(next);
    this.persist(next);
  }

  // ---- auth -------------------------------------------------------------
  checkPassword(pw: string): boolean {
    return pw === this._data().adminPassword;
  }

  setPassword(pw: string): void {
    const clean = pw.trim();
    if (clean) this.update((d) => ({ ...d, adminPassword: clean }));
  }

  // ---- global settings --------------------------------------------------
  setTimePerQuestion(seconds: number): void {
    const v = Math.max(5, Math.floor(seconds) || DEFAULT_TIME);
    this.update((d) => ({ ...d, timePerQuestion: v }));
  }

  // ---- sections ---------------------------------------------------------
  addSection(name: string): void {
    const clean = name.trim();
    if (!clean) return;
    this.update((d) => ({
      ...d,
      sections: [...d.sections, { id: uid(), name: clean }],
    }));
  }

  renameSection(id: string, name: string): void {
    const clean = name.trim();
    if (!clean) return;
    this.update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === id ? { ...s, name: clean } : s,
      ),
    }));
  }

  deleteSection(id: string): void {
    this.update((d) => ({
      ...d,
      sections: d.sections.filter((s) => s.id !== id),
      questions: d.questions.filter((q) => q.sectionId !== id),
    }));
  }

  /** Move a section up (-1) or down (+1) in display order. */
  moveSection(id: string, dir: -1 | 1): void {
    this.update((d) => {
      const arr = [...d.sections];
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, sections: arr };
    });
  }

  // ---- questions --------------------------------------------------------
  questionsForSection(sectionId: string): AdminQuestion[] {
    return this._data().questions.filter((q) => q.sectionId === sectionId);
  }

  addQuestion(sectionId: string): string {
    const id = uid();
    this.update((d) => ({
      ...d,
      questions: [
        ...d.questions,
        {
          id,
          sectionId,
          question: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: 'optionA',
          infoQuest:
            d.sections.find((s) => s.id === sectionId)?.name ?? '',
        },
      ],
    }));
    return id;
  }

  updateQuestion(id: string, patch: Partial<AdminQuestion>): void {
    this.update((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    }));
  }

  deleteQuestion(id: string): void {
    this.update((d) => ({
      ...d,
      questions: d.questions.filter((q) => q.id !== id),
    }));
  }

  /** Move a question within its section's ordering. */
  moveQuestion(id: string, dir: -1 | 1): void {
    this.update((d) => {
      const arr = [...d.questions];
      const i = arr.findIndex((q) => q.id === id);
      if (i < 0) return d;
      const sectionId = arr[i].sectionId;
      // find the previous/next question that shares the same section
      let j = i + dir;
      while (j >= 0 && j < arr.length && arr[j].sectionId !== sectionId) {
        j += dir;
      }
      if (j < 0 || j >= arr.length || arr[j].sectionId !== sectionId) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, questions: arr };
    });
  }

  // ---- player -----------------------------------------------------------
  /**
   * Questions for the chosen sections, in admin-defined section order then
   * question order. A question must have text and at least options A & B.
   */
  buildDeck(sectionIds: string[]): AdminQuestion[] {
    const d = this._data();
    const wanted = new Set(sectionIds);
    const order = new Map(d.sections.map((s, i) => [s.id, i]));
    return d.questions
      .filter(
        (q) =>
          wanted.has(q.sectionId) &&
          q.question.trim() &&
          q.optionA.trim() &&
          q.optionB.trim(),
      )
      .sort((a, b) => {
        const sa = order.get(a.sectionId) ?? 0;
        const sb = order.get(b.sectionId) ?? 0;
        if (sa !== sb) return sa - sb;
        return (
          d.questions.indexOf(a) - d.questions.indexOf(b)
        );
      });
  }

  resetToSeed(): void {
    const fresh = seed();
    this._data.set(fresh);
    this.persist(fresh);
  }
}
