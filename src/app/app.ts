import { Component } from '@angular/core';
import { QuizComponent } from './quiz.component';

@Component({
  selector: 'app-root',
  imports: [QuizComponent],
  template: '<app-quiz />',
})
export class App {}
