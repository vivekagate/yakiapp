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
import {ResourceEditComponent} from "./definition/resource-edit.component";
import {LogsModule} from "../logs/logs.module";
import {InstanceDialogComponent} from "./definition/instancedialog/instance-dialog.component";
import {AgGridModule} from "ag-grid-angular";
import {ConfirmDialogComponent} from "./definition/confirmdialog/confirm-dialog.component";
import {NewResourceDialogComponent} from "./definition/newresource-dialog/new-resource-dialog.component";
import {
    NewResourceGroupDialogComponent
} from "./definition/newresourcegroup-dialog/new-resource-group-dialog.component";

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
        LogsModule,
        FormsModule,
        AgGridModule,
    ],
  declarations: [ResourceComponent, ResourceEditComponent, InstanceDialogComponent, ConfirmDialogComponent, NewResourceDialogComponent, NewResourceGroupDialogComponent]
})
export class ResourceModule {
}
