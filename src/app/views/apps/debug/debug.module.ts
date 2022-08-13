import { NgModule } from '@angular/core';
import {CardModule, DropdownModule, GridModule, TableModule} from "@coreui/angular";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";
import {DebugComponent} from "./debug.component";
import {DebugRoutingModule} from "./debug-routing.module";
import {LogsModule} from "../logs/logs.module";
import {ChartjsModule} from "@coreui/angular-chartjs";
import {FormsModule} from "@angular/forms";
import {AgGridModule} from "ag-grid-angular";

@NgModule({
    imports: [
        CommonModule,
        GridsterModule,
        DebugRoutingModule,
        GridModule,
        CardModule,
        TableModule,
        LogsModule,
        ChartjsModule,
        FormsModule,
        DropdownModule,
        AgGridModule,
    ],
  declarations: [DebugComponent]
})
export class DebugModule {
}
