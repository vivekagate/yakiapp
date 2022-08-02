import { NgModule } from '@angular/core';
import {CardModule, DropdownModule, GridModule, TableModule, WidgetModule} from "@coreui/angular";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";
import {ChartSample, DashboardComponent} from "./dashboard.component";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {LogsModule} from "../logs/logs.module";
import {ChartjsModule} from "@coreui/angular-chartjs";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";

@NgModule({
  imports: [
    CommonModule,
    WidgetModule,
    GridsterModule,
    DashboardRoutingModule,
    GridModule,
    CardModule,
    TableModule,
    LogsModule,
    ChartjsModule,
    FormsModule,
    DropdownModule,
    FontAwesomeModule
  ],
  declarations: [DashboardComponent, ChartSample]
})
export class DashboardModule {
}
