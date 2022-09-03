import { Injectable } from '@angular/core';
import {AgGridColumn, ICellRendererAngularComp} from "ag-grid-angular";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {ICellRendererParams} from "ag-grid-community";
import {DeploymentDefinition} from "./definition/deployment-definition";
import {ResourceDefinitionCommon} from "./definition/resource-definition-common";
import {NewResourceDialogComponent} from "./definition/newresource-dialog/new-resource-dialog.component";

export interface Command {
    command: string;
    arguments: {};
}

export interface Action {
    name: string;
    displayName?: string;
    icon: string;
    callback: any;
}

export interface Attribute {
    name: string;
    resource_field: any;
}

export interface Section {
    name: string;
    attributes: Attribute[];
    hidden?: boolean;
}

export interface SideBar {
    name: string;
    mode: string;
    data: any;
}

export interface Resource {
    name?: string;
    columns: AgGridColumn[];
    command?: Command[];
    actions?: Action[];
    resourceListActions?: Action[];
    sections?: Section[];
    sidebar?: SideBar;
}

export class ResourceValueRenderer implements ICellRendererAngularComp {
    public cellValue: string | undefined;

    // gets called once before the renderer is used
    agInit(params: ICellRendererParams): void {
        console.log(params);
        this.cellValue = this.getValueToDisplay(params);
    }

    // gets called whenever the cell refreshes
    refresh(params: ICellRendererParams): boolean {
        // set value into cell again
        this.cellValue = this.getValueToDisplay(params);
        return true;
    }

    getValueToDisplay(params: ICellRendererParams) {
        return params.valueFormatted ? params.valueFormatted : params.value;
    }
}

@Injectable({
    providedIn: 'any'
})
export class ResourceData {
    constructor(private beService: TauriAdapter, private common: ResourceDefinitionCommon,  private deployDefinition: DeploymentDefinition) {
        this.resourceMap = new Map();
        this.resourceMap.set('pods', deployDefinition.getPodResourceDefinition());
        this.resourceMap.set('namespaces', deployDefinition.getNamespacesResourceDefinition());
        this.resourceMap.set('deployments', deployDefinition.getDeploymentResourceDefinition());
        this.resourceMap.set('configmaps', deployDefinition.getConfigMapsResourceDefinition());
        this.resourceMap.set('hpas', deployDefinition.getHpasResourceDefinition());
        this.resourceMap.set('cronjobs', this.getCronJobsResourceDefinition());
        this.resourceMap.set('daemonsets', this.getDaemonSetsResourceDefinition());
        this.resourceMap.set('services', deployDefinition.getServicesResourceDefinition());
        this.resourceMap.set('nodes', this.getNodeResourceDefinition());
        this.resourceMap.set('applications', deployDefinition.getApplicationResourceDefinition());
        this.resourceMap.set('crds', deployDefinition.getCustomResourceDefinition());
    }

    public resourceMap: Map<string, Resource> | undefined;

    public getResource(name: string): Resource {
        // @ts-ignore
        const resource = this.resourceMap.get(name);
        if (!resource) {
            console.log('Resource not found');
            return {columns: [], command: [], name: "UNKNOWN"};
        }
        return resource;
    }

    nodeDef = [
        ['Name', 'metadata.name'],
        ['Status', (params: any) => {
            const conditions: any[] = params.data.status.conditions;
            let value = 'N/A'
            if (conditions && conditions.length > 0) {
                for (const condition of conditions) {
                    if (condition.status === 'True') {
                        value = condition.type;
                        break;
                    }
                }
            }
            let eGui = document.createElement('span');
            if (value !== 'Ready') {
                eGui.classList.add('link-danger');
                eGui.innerHTML = `${value}&nbsp;&nbsp;<i class='fa fa-warning'></i>`
            }else{
                eGui.innerHTML = `${value}`
            }
            return eGui;
        }],
        ['Age', this.common.getAge],
        ['CPU usage (%)', (params: any) => {
            const allocatable = params.data.status.allocatable;
            const node_usage = params.data.status.usage;
            let value = 0;
            let battery_level = 0;
            let color = '';
            if (allocatable) {
                try{
                    let limit: number;
                    let usage = 0;
                    if (!allocatable.cpu) {
                        limit = 9999999999;
                    }else{
                        let mult_factor = 1000000000;
                        if(allocatable.cpu && allocatable.cpu.endsWith('m')) {
                            mult_factor = 1000000;
                        }

                        limit = Number(allocatable.cpu.replace('m','')) * mult_factor;
                    }
                    if (node_usage) {
                        usage = Number(node_usage.cpu.replace('n', ''));
                    }
                    value = Math.round(usage*100/limit);
                    battery_level = Math.round(value/20);
                    if (value > 60 && value < 80) {
                        color = 'link-warning';
                    }else if (value > 80) {
                        color = 'link-danger';
                    }else {
                        color = 'link-success';
                    }
                }catch(e){
                    value = 0;
                }
            }
            let eGui = document.createElement('span');
            if (color) {
                eGui.classList.add(color);
            }
            eGui.innerHTML = `${value}%&nbsp;&nbsp;<i class='fa fa-battery-${battery_level} fa-rotate-270'></i>`
            return eGui;
        }],
        ['Memory usage (%)', (params: any) => {
            const allocatable = params.data.status.allocatable;
            const node_usage = params.data.status.usage;
            let value = 0;
            let battery_level = 0;
            let color = '';
            if (allocatable) {
                try{
                    let limit: number;
                    let usage = 0;
                    if (!allocatable) {
                        limit = 9999999999;
                    }else{
                        let mult_factor = 1000000;
                        if(allocatable.memory && allocatable.memory.endsWith('Mi')) {
                            mult_factor = 1000;
                        }else if(allocatable.memory && allocatable.memory.endsWith('Ki')) {
                            mult_factor = 1;
                        }
                        limit = Number(allocatable.memory.replace('Ki','').replace('Mi','').replace('Gi','')) * mult_factor;
                    }
                    if (node_usage) {
                        usage = Number(node_usage.memory.replace('Ki', ''));
                    }
                    value = Math.round(usage*100/limit);
                    battery_level = Math.round(value/20);
                    if (value > 60 && value < 80) {
                        color = 'link-warning';
                    }else if (value > 80) {
                        color = 'link-danger';
                    }else {
                        color = 'link-success';
                    }
                }catch(e){
                    value = 0;
                }
            }
            let eGui = document.createElement('span');
            if (color) {
                eGui.classList.add(color);
            }
            eGui.innerHTML = `${value}%&nbsp;&nbsp;<i class='fa fa-battery-${battery_level} fa-rotate-270'></i>`
            return eGui;
        }],
    ];

    cronJobDef = [
        ['Name', 'metadata.name'],
        ['Namespace', 'metadata.namespace'],
        ['Status', (params: any) => {
            let eGui = document.createElement('span');
            eGui.innerHTML = `${params.data.status}`
            return eGui;
        }],
        ['Age', this.common.getAge],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    daemonSetDef = [
        ['Name', 'metadata.name'],
        ['Namespace', 'metadata.namespace'],
        ['Status', (params: any) => {
            let eGui = document.createElement('span');
            eGui.innerHTML = `${params.data.status}`
            return eGui;
        }],
        ['Age', this.common.getAge],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    private getNodeResourceDefinition(): Resource {
        return {
            columns: this.common.getColumnDef(this.nodeDef),
            command: [
                {
                    command: this.beService.commands.get_resource_with_metrics,
                    arguments: {
                        kind: 'node'
                    }
                }
            ],
            name: "Nodes",
            sections: [
                {
                    name: 'Overview',
                    attributes: [
                        {
                            name: 'Creation TS',
                            resource_field: 'metadata.creationTimestamp'
                        },
                        {
                            name: 'OS Image',
                            resource_field: 'status.nodeInfo.osImage'
                        },
                        {
                            name: 'Kubelet Version',
                            resource_field: 'status.nodeInfo.kubeletVersion'
                        },
                        {
                            name: 'Container Runtime Version',
                            resource_field: 'status.nodeInfo.containerRuntimeVersion'
                        },
                    ]
                }
            ]
        }
    }

    private getCronJobsResourceDefinition() {
        return {
            columns: this.common.getColumnDef(this.cronJobDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'cronjob'
                    }
                }
            ],
            name: "Cron Jobs"
        }
    }

    private getDaemonSetsResourceDefinition() {
        return {
            columns: this.common.getColumnDef(this.daemonSetDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'daemonset'
                    }
                }
            ],
            name: "Daemon Sets"
        }
    }

}
