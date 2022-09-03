import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DefaultLayoutComponent } from './containers';
import {ResourceModule} from "./views/apps/resource/resource.module";

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
        path: 'oapplications',
        loadChildren: () =>
          import('./views/apps/applications/applications.module').then((m) => m.ApplicationsModule)
      },
      {
        path: 'applications',
        data: {
          resource: 'applications'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'namespaces',
        data: {
          resource: 'namespaces'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'nodes',
        data: {
          resource: 'nodes'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'deployments',
        data: {
          resource: 'deployments'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'pods',
        data: {
          resource: 'pods'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'services',
        data: {
          resource: 'services'
        },
        loadChildren: () => ResourceModule
      },
      {
        path: 'cronjobs',
        data: {
          resource: 'cronjobs'
        },
        loadChildren: () => ResourceModule
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
        path: 'hpas',
        data: {
          resource: 'hpas'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'crds',
        data: {
          resource: 'crds'
        },
        loadChildren: () =>
            import('./views/apps/resource/resource.module').then((m) => m.ResourceModule)
      },
      {
        path: 'preferences',
        loadChildren: () =>
            import('./views/apps/preferences/preferences.module').then((m) => m.PreferencesModule)
      },
      {
        path: 'logs',
        loadChildren: () =>
          import('./views/apps/logs/logs.module').then((m) => m.LogsModule)
      },
      {
        path: 'shell',
        loadChildren: () =>
            import('./views/apps/shell/shell.module').then((m) => m.ShellModule)
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
