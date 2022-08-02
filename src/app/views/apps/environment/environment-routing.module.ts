import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {EnvironmentComponent} from "./environment.component";

const routes: Routes = [
  {
    path: '',
    component: EnvironmentComponent,
    data: {
      title: $localize`Environment`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EnvironmentRoutingModule {
}
