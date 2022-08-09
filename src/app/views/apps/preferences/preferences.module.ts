import { NgModule } from '@angular/core';
import {CardModule, GridModule, TableModule} from "@coreui/angular";
import {GridsterModule} from "angular-gridster2";
import {CommonModule} from "@angular/common";
import {PreferencesComponent} from "./preferences.component";
import {PreferencesRoutingModule} from "./preferences-routing.module";
import {FormsModule} from "@angular/forms";

@NgModule({
    imports: [
        CommonModule,
        GridsterModule,
        PreferencesRoutingModule,
        GridModule,
        CardModule,
        TableModule,
        FormsModule,
    ],
  declarations: [PreferencesComponent]
})
export class PreferencesModule {
}
