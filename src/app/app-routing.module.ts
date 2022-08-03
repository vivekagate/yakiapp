import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DefaultLayoutComponent } from './containers';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'pods',
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
        path: 'nodes',
        data: {
          resource: 'nodes'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'deployments',
        data: {
          resource: 'deployments'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'pods',
        data: {
          resource: 'pods'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'services',
        data: {
          resource: 'services'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'cronjobs',
        data: {
          resource: 'cronjobs'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'configmaps',
        data: {
          resource: 'configmaps'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'daemonsets',
        data: {
          resource: 'daemonsets'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
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
