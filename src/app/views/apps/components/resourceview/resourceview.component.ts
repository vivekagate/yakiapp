import {Component, Input, NgZone} from "@angular/core";
import {EventListener} from "../../../../providers/types";
import {AgGridColumn} from "ag-grid-angular";
import {ColDef, GridReadyEvent, RowClickedEvent} from "ag-grid-community";
import {Observable} from "rxjs";
import {Resource} from "../../resource/resource-data";
import * as _ from "lodash";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";

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

    constructor(private beService: TauriAdapter, private ngZone: NgZone) {
        this.columnDefs = [];
        this.defaultColDef = {};
        this.rowData$ = new Observable<any[]>();
        this.resource = {columns: [], command: [], name: ""};
        this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    }

    ngOnDestroy(): void {
        this.beService.unRegisterListener(this);
    }

    ngOnInit(): void {
        console.log(this.resource);
        this.resource.command?.forEach((cmd) => {
            const args = Object.assign({
                ns: this.beService.storage.ns
            }, cmd.arguments);
            this.beService.executeCommand(cmd.command, args,true);
        })
    }



    getName(): string {
        return "";
    }

    handleEvent(ev: any): void {
        const evname = ev.name;
        const payload = ev.payload;

        let results: any;
        try {
            results = JSON.parse(_.get(payload, 'data'));
        } catch (e) {
            console.error("Failed to parse payload");
        }

        if (evname === this.beService.response_channel["app_command_result"]) {
            let cmd = _.get(payload, 'command');

            console.log(results);

            // if (cmd === this.beService.commands.get_all_ns) {
            //     this.ngZone.run(() => {
            //         this.namespaces = results;
            //     });
            // }
        }
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