import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {ResourceComponent} from "./resource.component";

const routes: Routes = [
  {
    path: '',
    component: ResourceComponent,
    data: {
      title: $localize`Resource`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ResourceRoutingModule {
}
