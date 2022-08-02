import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {DebugComponent} from "./debug.component";

const routes: Routes = [
  {
    path: '',
    component: DebugComponent,
    data: {
      title: $localize`Debug`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DebugRoutingModule {
}
