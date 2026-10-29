import { Routes } from '@angular/router';
import { TaskPage } from './tasks/task-page';

/** `data.titleKey` lo usa `I18nTitleStrategy` para el título de la pestaña en el idioma actual. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hoy' },
  { path: 'hoy', component: TaskPage, data: { view: 'hoy', titleKey: 'view.hoy' } },
  { path: 'proximas', component: TaskPage, data: { view: 'proximas', titleKey: 'view.proximas' } },
  { path: 'todas', component: TaskPage, data: { view: 'todas', titleKey: 'view.todas' } },
  {
    path: 'completadas',
    component: TaskPage,
    data: { view: 'completadas', titleKey: 'view.completadas' },
  },
  { path: 'etiqueta/:tag', component: TaskPage },
  {
    path: 'estadisticas',
    loadComponent: () => import('./stats/stats-page').then((m) => m.StatsPage),
    data: { titleKey: 'view.estadisticas' },
  },
  { path: '**', redirectTo: 'hoy' },
];
