import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {PreferencesComponent} from "./preferences.component";

const routes: Routes = [
  {
    path: '',
    component: PreferencesComponent,
    data: {
      title: $localize`Environment`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PreferencesRoutingModule {
}
