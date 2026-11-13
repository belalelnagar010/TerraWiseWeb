import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'field' },
  {
    path: 'field',
    loadComponent: () =>
      import('./pages/field-map/field-map').then((m) => m.FieldMapComponent),
  },
  {
    path: 'setup',
    loadComponent: () => import('./pages/setup/setup').then((m) => m.SetupComponent),
  },
  {
    path: 'results',
    loadComponent: () => import('./pages/results/results').then((m) => m.ResultsComponent),
  },
  { path: '**', redirectTo: 'field' },
];
