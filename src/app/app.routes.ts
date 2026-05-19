import { Routes } from '@angular/router';
import { QuizComponent } from './quiz.component';
import { AdminComponent } from './admin.component';

export const routes: Routes = [
  { path: '', component: QuizComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' },
];
