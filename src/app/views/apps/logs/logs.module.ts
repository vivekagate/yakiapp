import { NgModule } from '@angular/core';
import {LogsComponent} from "./logs.component";
import {LogsRoutingModule} from "./logs-routing.module";
import {CardModule, GridModule} from "@coreui/angular";
import {TerminalComponent} from "./terminal/terminal.component";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";

@NgModule({
    imports: [
        CommonModule,
        GridsterModule,
        LogsRoutingModule,
        GridModule,
        CardModule,
        FormsModule,
    ],
  exports: [
    TerminalComponent,
    LogsComponent
  ],
  declarations: [LogsComponent, TerminalComponent]
})
export class LogsModule {
}
