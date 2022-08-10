import {Component, Input, NgZone, ViewChild} from "@angular/core";
import {EventListener} from "../../../../providers/types";
import {AgGridAngular, AgGridColumn} from "ag-grid-angular";
import {ColDef, GridReadyEvent, RowClickedEvent} from "ag-grid-community";
import {from, Observable, tap, Subscription} from "rxjs";
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
import {MetaData} from "ng-event-bus/lib/meta-data";
import {NgEventBus} from "ng-event-bus";

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

    @ViewChild('resourcedetailtable')
    resourceDetailsTable!: AgGridAngular;

    @Input()
    resource: Resource;
    defaultColDef: ColDef = {
        editable: false,
        sortable: true,
        flex: 1,
        minWidth: 100,
        filter: true,
        resizable: true,
    };

    rowData$: Observable<any> = from([]);
    rowData: any[] = [];
    data: any[] = [];
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
    subscription: Subscription | undefined;

    constructor(private beService: TauriAdapter, private ngZone: NgZone, private eventBus: NgEventBus) {
        this.columnDefs = [];
        this.rowData$ = new Observable<any[]>;
        this.resource = {columns: [], command: [], name: ""};
        this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    }

    ngOnDestroy(): void {
        this.beService.unRegisterListener(this);
        this.subscription?.unsubscribe();
    }

    ngOnInit(): void {
        this.ngZone.run(() => {
            this.columnDefs = this.resource.columns;
        });
        this.initialize();

        this.subscription = this.eventBus.on(this.beService.ngeventbus.app_events).subscribe((meta: MetaData) => {
            if (meta.data === this.beService.ngevent.cluster_changed) {
                this.isLoading = true;
                this.clearTable();
            }else if (meta.data === this.beService.ngevent.ns_changed) {
                this.isLoading = true;
                this.clearTable();
                this.initialize();
            }else if (meta.data === this.beService.ngevent.escape_hit) {
                if ( ! this.isSideBarHidden) {
                    this.isSideBarHidden = true;
                }
            }
        });
    }

    initialize(): void {
        let delay = 0;
        this.data = [];
        this.resource.command?.forEach((cmd) => {
            setTimeout(() => {
                this.beService.executeCommandInCurrentNs(cmd.command, cmd.arguments,true);
            }, delay);
            delay += 1000;
        });
    }

    clearTable(): void {
        this.ngZone.run(() => {
            this.rowData$ = from([]);
            this.aggrid.api.setRowData([]);
        })
    }

    getName(): string {
        return "resourceview.component";
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
            const nameMetricMap = new Map();
            const nameMetric2Map = new Map();
            const specNameMap = new Map();
            const deployNameToPodsMap = new Map();
            if (!results.items && results.resource && results.metrics) {
                results.items = JSON.parse(results.resource).items;
                const metrics = JSON.parse(results.metrics);
                metrics.items.forEach((m: any) => {
                    nameMetricMap.set(m.metadata.name, m);
                })
                if (results.metrics2) {
                    const metrics2 = JSON.parse(results.metrics2);
                    metrics2.items.forEach((m: any) => {
                        nameMetric2Map.set(m.metadata.name, m);
                    })
                }
                if (results.usage) {
                    const md = JSON.parse(results.usage);
                    md.items.forEach((pod: any) => {
                        if (pod.spec.containers) {
                            const deployname = pod.spec.containers[0].name;
                            let resourceArray = specNameMap.get(deployname);
                            if (!resourceArray) {
                                resourceArray = [];
                                specNameMap.set(deployname, resourceArray);
                            }
                            resourceArray.push({
                                name: pod.metadata.name,
                                usage: nameMetricMap.get(pod.metadata.name),
                                status: pod.status
                            });

                            let podArray = deployNameToPodsMap.get(deployname);
                            if (!podArray) {
                                podArray = [];
                                deployNameToPodsMap.set(deployname, podArray);
                            }
                            podArray.push(pod);
                            const pmetric = nameMetricMap.get(pod.metadata.name);
                            if (pmetric && pmetric.containers && pmetric.containers.length > 0) {
                                pod.spec.containers[0].resources.usage = pmetric.containers[0].usage;
                            }
                        }
                    })
                }
            }

            if (results.items) {
                results.items.forEach((item: any) => {
                    if (item.kind === 'Node') {
                        const metric = nameMetricMap.get(item.metadata.name);
                        if (metric && metric.usage) {
                            item.status.usage = metric.usage;
                        }
                    }else if (item.kind === 'Pod') {
                        if (item.spec.containers && item.spec.containers.length > 0){
                            const metric = nameMetricMap.get(item.metadata.name);
                            if (metric && metric.containers && metric.containers.length > 0) {
                                item.spec.containers[0].resources.usage = metric.containers[0].usage;
                            }
                        }
                    }else if (item.kind === 'Deployment') {
                        if (item.spec.template.spec.containers) {
                            const deployname = item.spec.template.spec.containers[0].name;
                            const usages = specNameMap.get(deployname);
                            const pods = deployNameToPodsMap.get(deployname);
                            if (usages && item.spec.template.spec.containers) {
                                item.spec.template.spec.containers[0].resources.usages = usages;
                                item.spec.template.spec.pods = pods;
                            }
                        }
                    }
                    item.flat = flatten(item);
                });

                this.ngZone.run(() => {
                    this.data = this.data.concat(results.items);
                    this.rowData = this.data;
                    this.isLoading = false;
                });
            }
        }
    }

    onSelect(app: RowClickedEvent<any>) {
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

    onAction(name: string) {
        const action = this.resource.actions?.filter(ac => ac.name === name)[0];
        action?.callback(this.selectedapp);
    }

    getAttrValue(resource_field: any) {
        if (this.selectedapp) {
            if ((typeof resource_field) === 'function'){
                return resource_field(this.selectedapp).outerHTML;
            }
            const value = this.selectedapp?.flat[resource_field];
            let eGui = document.createElement('span');
            if (value) {
                eGui.innerHTML = `${value}`
            }
            return eGui.outerHTML;
        }else{
            return 'N/A';
        }
    }
}