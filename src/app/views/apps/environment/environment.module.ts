import { NgModule } from '@angular/core';
import {CardModule, GridModule, TableModule} from "@coreui/angular";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";
import {EnvironmentComponent} from "./environment.component";
import {EnvironmentRoutingModule} from "./environment-routing.module";

@NgModule({
  imports: [
    CommonModule,
    GridsterModule,
    EnvironmentRoutingModule,
    GridModule,
    CardModule,
    TableModule,
  ],
  declarations: [EnvironmentComponent]
})
export class EnvironmentModule {
}
