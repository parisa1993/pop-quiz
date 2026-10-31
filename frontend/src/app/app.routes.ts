import { Routes } from '@angular/router';
import { adminGuard, playerGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  {
    path: 'play/name',
    title: 'Pick your name · Pop Quiz',
    loadComponent: () => import('./features/play/pick-name.page').then((m) => m.PickNamePage),
  },
  {
    path: 'play',
    title: 'Games · Pop Quiz',
    canActivate: [playerGuard],
    loadComponent: () => import('./features/play/game-list.page').then((m) => m.GameListPage),
  },
  {
    path: 'play/:sessionId',
    title: 'Playing · Pop Quiz',
    canActivate: [playerGuard],
    loadComponent: () => import('./features/play/game.page').then((m) => m.GamePage),
  },
  {
    path: 'admin/login',
    title: 'Admin · Pop Quiz',
    loadComponent: () => import('./features/admin/admin-login.page').then((m) => m.AdminLoginPage),
  },
  {
    path: 'admin/host/:sessionId',
    title: 'Hosting · Pop Quiz',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/host/host.page').then((m) => m.HostPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'quizzes' },
      {
        path: 'quizzes',
        title: 'Quizzes · Pop Quiz',
        loadComponent: () =>
          import('./features/admin/quiz-list/quiz-list.page').then((m) => m.QuizListPage),
      },
      {
        path: 'quizzes/new',
        title: 'New quiz · Pop Quiz',
        loadComponent: () =>
          import('./features/admin/quiz-editor/quiz-editor.page').then((m) => m.QuizEditorPage),
      },
      {
        path: 'quizzes/:id',
        title: 'Edit quiz · Pop Quiz',
        loadComponent: () =>
          import('./features/admin/quiz-editor/quiz-editor.page').then((m) => m.QuizEditorPage),
      },
      {
        path: 'quizzes/:id/results',
        title: 'Results · Pop Quiz',
        loadComponent: () =>
          import('./features/admin/results/results.page').then((m) => m.ResultsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
