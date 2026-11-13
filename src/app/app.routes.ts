import { Routes } from '@angular/router';
import { fieldSelectedGuard } from './core/field.guard';

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
    canActivate: [fieldSelectedGuard],
    loadComponent: () => import('./pages/results/results').then((m) => m.ResultsComponent),
  },
  {
    path: 'agronomist',
    loadComponent: () => import('./pages/agronomist/agronomist').then((m) => m.AgronomistComponent),
  },
  { path: '**', redirectTo: 'field' },
];
