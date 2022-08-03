import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

import {
    AccordionModule,
    AvatarModule,
    ButtonGroupModule,
    ButtonModule,
    CardModule,
    FormModule,
    GridModule,
    NavModule,
    ProgressModule, SharedModule, SidebarModule, SpinnerModule,
    TableModule,
    TabsModule, TooltipModule, UtilitiesModule
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { ChartjsModule } from '@coreui/angular-chartjs';


import {ResourceComponent} from "./resource.component";
import {ResourceRoutingModule} from "./resource-routing.module";
import {ResourceViewModule} from "../components/resourceview/resourceview.module";

@NgModule({
    imports: [
        ResourceRoutingModule,
        CardModule,
        NavModule,
        IconModule,
        TabsModule,
        CommonModule,
        GridModule,
        SharedModule,
        ResourceViewModule,
    ],
  declarations: [ResourceComponent]
})
export class ResourceModule {
}
