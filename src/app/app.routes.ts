import { Routes } from '@angular/router';
import { TaskPage } from './tasks/task-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hoy' },
  { path: 'hoy', component: TaskPage, data: { view: 'hoy' }, title: 'Hoy · Hecho' },
  { path: 'proximas', component: TaskPage, data: { view: 'proximas' }, title: 'Próximas · Hecho' },
  { path: 'todas', component: TaskPage, data: { view: 'todas' }, title: 'Todas · Hecho' },
  {
    path: 'completadas',
    component: TaskPage,
    data: { view: 'completadas' },
    title: 'Completadas · Hecho',
  },
  {
    path: 'etiqueta/:tag',
    component: TaskPage,
    title: (route) => `#${route.paramMap.get('tag')} · Hecho`,
  },
  { path: '**', redirectTo: 'hoy' },
];
