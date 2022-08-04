import {Component, Input, NgZone, ViewChild} from "@angular/core";
import {EventListener} from "../../../../providers/types";
import {AgGridAngular, AgGridColumn} from "ag-grid-angular";
import {ColDef, GridReadyEvent, RowClickedEvent} from "ag-grid-community";
import {from, Observable, of} from "rxjs";
import {Resource} from "../../resource/resource-data";
import * as _ from "lodash";
import {flatten} from "flat";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";
import {
    faArrowsRotate, faChevronRight,
    faCircleExclamation,
    faCircleXmark,
    faFileLines,
    faSpinner, faStop, faXmark
} from "@fortawesome/free-solid-svg-icons";

export enum COL_TYPE {
    number,
    string,

}
@Component({
    selector: 'app-resourceview',
    templateUrl: './resourceview.component.html',
    styleUrls: ['./resourceview.component.scss']
})
export class ResourceviewComponent implements EventListener {
    isLoading = true;
    resourceinstances = [];
    isSideBarHidden = true;

    columnDefs: AgGridColumn[];

    @ViewChild('aggrid')
    aggrid!: AgGridAngular;

    @Input()
    resource: Resource;
    defaultColDef: ColDef;

    rowData$: Observable<any> = from([]);
    rowData = [];
    selectedapp: any;


    // faCircleCheck = faCircleCheck;
    faCircleX = faCircleXmark;
    faCircleWarn = faCircleExclamation;
    faTailLog = faFileLines;
    faRestart = faArrowsRotate;
    // faTerminal = faTerminal;
    faLoading = faSpinner;
    faClose = faChevronRight;
    faCross = faXmark;
    // faCheck = faCheck;
    faStopped = faStop;

    constructor(private beService: TauriAdapter, private ngZone: NgZone) {
        this.columnDefs = [];
        this.defaultColDef = {};
        this.rowData$ = new Observable<any[]>;
        this.resource = {columns: [], command: [], name: ""};
        this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    }

    ngOnDestroy(): void {
        this.beService.unRegisterListener(this);
    }

    ngOnInit(): void {
        this.ngZone.run(() => {
            this.columnDefs = this.resource.columns;
        });
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
            if (results.items) {
                results.items.forEach((item: any) => {
                    item.flat = flatten(item);
                })
                this.ngZone.run(() => {
                    // @ts-ignore
                    this.rowData$ = from(results.items);
                    this.rowData = results.items;
                        console.log(results.items);
                        console.log(this.columnDefs);
                    this.isLoading = false;
                });
            }

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
        console.log(app);
        this.selectedapp = app.data;
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