import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DefaultLayoutComponent } from './containers';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'applications',
    pathMatch: 'full'
  },
  {
    path: '',
    component: DefaultLayoutComponent,
    data: {
      title: 'Home'
    },
    children: [
      {
        path: 'applications',
        loadChildren: () =>
          import('./views/apps/applications/applications.module').then((m) => m.ApplicationsModule)
      },
      {
        path: 'deployments',
        loadChildren: () =>
            import('./views/apps/applications/applications.module').then((m) => m.ApplicationsModule)
      },
      {
        path: 'pods',
        loadChildren: () =>
            import('./views/apps/applications/applications.module').then((m) => m.ApplicationsModule)
      },
      {
        path: 'logs',
        loadChildren: () =>
          import('./views/apps/logs/logs.module').then((m) => m.LogsModule)
      },
      {
        path: 'environment',
        loadChildren: () =>
          import('./views/apps/environment/environment.module').then((m) => m.EnvironmentModule)
      },
      {
        path: 'debug',
        loadChildren: () =>
          import('./views/apps/debug/debug.module').then((m) => m.DebugModule)
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./views/apps/dashboard/dashboard.module').then((m) => m.DashboardModule)
      },
    ]
  },
  {path: '**', redirectTo: 'dashboard'}
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled',
      initialNavigation: 'enabledBlocking'
      // relativeLinkResolution: 'legacy'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
