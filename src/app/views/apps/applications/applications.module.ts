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


import {ApplicationsComponent} from "./applications.component";
import {ApplicationsRoutingModule} from "./applications-routing.module";
import {NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";

@NgModule({
    imports: [
        ApplicationsRoutingModule,
        CardModule,
        NavModule,
        IconModule,
        TabsModule,
        CommonModule,
        GridModule,
        ProgressModule,
        ReactiveFormsModule,
        ButtonModule,
        FormModule,
        ButtonModule,
        ButtonGroupModule,
        ChartjsModule,
        AvatarModule,
        TableModule,
        UtilitiesModule,
        FormsModule,
        NgbTooltipModule,
        FontAwesomeModule,
        SpinnerModule,
        SidebarModule,
        AccordionModule,
        SharedModule,
        TooltipModule,
    ],
  declarations: [ApplicationsComponent]
})
export class ApplicationsModule {
}
