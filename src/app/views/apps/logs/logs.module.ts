import { NgModule } from '@angular/core';
import {LogsComponent} from "./logs.component";
import {LogsRoutingModule} from "./logs-routing.module";
import {CardModule, GridModule} from "@coreui/angular";
import {TerminalComponent} from "./terminal/terminal.component";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";

@NgModule({
  imports: [
    CommonModule,
    GridsterModule,
    LogsRoutingModule,
    GridModule,
    CardModule,
  ],
  exports: [
    TerminalComponent,
    LogsComponent
  ],
  declarations: [LogsComponent, TerminalComponent]
})
export class LogsModule {
}
