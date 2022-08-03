import {Component, Input} from "@angular/core";
import {EventListener} from "../../../../providers/types";
import {AgGridColumn} from "ag-grid-angular";
import {ColDef, GridReadyEvent, RowClickedEvent} from "ag-grid-community";
import {Observable} from "rxjs";
import {Resource} from "../../resource/resource-data";

export enum COL_TYPE {
    number,
    string,

}
@Component({
    selector: 'app-resourceview',
    templateUrl: './resourceview.component.html',
})
export class ResourceviewComponent implements EventListener {
    isLoading = true;
    resourceinstances = [];
    isSideBarHidden = true;

    @Input()
    columnDefs: AgGridColumn[];

    @Input()
    resource: Resource;
    defaultColDef: ColDef;

    rowData$: Observable<any[]>;

    constructor() {
        this.columnDefs = [];
        this.defaultColDef = {};
        this.rowData$ = new Observable<any[]>();
        this.resource = {columns: [], command: "", name: ""}
    }

    getName(): string {
        return "";
    }

    handleEvent(ev: any): void {
    }

    onSelect(app: RowClickedEvent<any>) {
        // this.deployments.forEach((d) => {
        //     if (d.deployment.metadata.name === app) {
        //         this.selectedapp = d;
        //         this.resetMetrics();
        //     }
        // });
        this.isSideBarHidden = !this.isSideBarHidden;
        if (!this.isSideBarHidden) {
            // this.isEnvsLoading = true;
            // this.beService.executeCommand(this.beService.commands.get_pods_for_deployment_async, {
            //     ns: this.selectedNs.name,
            //     deployment: app
            // }, true);
            //
            // this.isMetricsLoading = true;
            // this.beService.executeCommand(this.beService.commands.get_metrics_for_deployment, {
            //     ns: this.selectedNs.name,
            //     deployment: app
            // }, true);
        }
    }

    onGridReady($event: GridReadyEvent<any>) {

    }
}