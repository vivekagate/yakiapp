import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {ShellComponent} from "./shell.component";

const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    data: {
      title: $localize`Shell`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ShellRoutingModule {
}
