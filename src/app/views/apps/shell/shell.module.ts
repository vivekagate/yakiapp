import { NgModule } from '@angular/core';
import {ShellComponent} from "./shell.component";
import {ShellRoutingModule} from "./shell-routing.module";
import {CardModule, DropdownModule, GridModule} from "@coreui/angular";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";

@NgModule({
    imports: [
        CommonModule,
        ShellRoutingModule,
        CardModule,
        FormsModule,
        DropdownModule,
        GridModule,
    ],
  exports: [
    ShellComponent
  ],
  declarations: [ShellComponent]
})
export class ShellModule {
}
