import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {ApplicationsComponent} from "./applications.component";

const routes: Routes = [
  {
    path: '',
    component: ApplicationsComponent,
    data: {
      title: $localize`Apps`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplicationsRoutingModule {
}
