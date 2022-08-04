import { Injectable } from '@angular/core';
import {AgGridColumn} from "ag-grid-angular";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {ValueGetterFunc} from "ag-grid-community";

export interface Command {
    command: string;
    arguments: {};
}
export interface Resource {
    name?: string;
    columns: AgGridColumn[];
    command?: Command[];
}

@Injectable({
    providedIn: 'any'
})
export class ResourceData {
    constructor(private beService: TauriAdapter) {
        this.resourceMap = new Map();
        this.resourceMap.set('pods', this.getPodResourceDefinition());
        this.resourceMap.set('deployments', this.getDeploymentResourceDefinition());
        this.resourceMap.set('configmaps', this.getConfigMapsResourceDefinition());
        this.resourceMap.set('cronjobs', this.getCronJobsResourceDefinition());
        this.resourceMap.set('daemonsets', this.getDaemonSetsResourceDefinition());
        this.resourceMap.set('services', this.getServicesResourceDefinition());
        this.resourceMap.set('nodes', this.getNodeResourceDefinition());
    }

    public resourceMap: Map<string, Resource> | undefined;

    public getResource(name: string): Resource {
        // @ts-ignore
        const resource = this.resourceMap.get(name);
        if (!resource) {
            return {columns: [], command: [], name: "UNKNOWN"};
        }
        return resource;
    }


    nodeDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    podDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    configMapDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    cronJobDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    serviceDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    daemonSetDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    deploymentDef = [
        ['Name', 'metadata.name'],
        ['Status', (d: any) => d.data.status],
        ['Pods', (d: any) => {
            if (d.data.status.availableReplicas) {
                return d.data.status.availableReplicas + '/' + d.data.status.replicas;
            } else {
                return '0/' + d.data.status.replicas
            }
        }],
        ['CPU', (d: any) => d.data.status],
        ['Memory', (d: any) => d.data.status],
    ];


    private getPodResourceDefinition(): Resource {
        return {
            columns: this.getColumnDef(this.podDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'pod'
                    }
                }
            ],
            name: "Pods"
        }
    }

    private getColumneDef(name: string, field: string ): AgGridColumn {
        const col = new AgGridColumn();
        col.field = field;
        col.headerName = name;
        return col;
    }

    private getColumneDefWithValueGetter(name: string, valueGetter: any ): AgGridColumn {
        const col = new AgGridColumn();
        col.headerName = name;
        col.valueGetter = valueGetter
        return col;
    }

    private getColumnDef(args: any) {
        let colDef: AgGridColumn[] = [];
        if (args) {
            for (let i = 0; i < args.length; i++) {
                let col = args[i];
                let name = col[0];
                if (typeof col[1] === 'string') {
                    colDef.push(this.getColumneDef(name, col[1]));
                }else{
                    colDef.push(this.getColumneDefWithValueGetter(name, col[1]));
                }
            }
        }
        return colDef;
    }

    private getNodeResourceDefinition(): Resource {
        return {
            columns: this.getColumnDef(this.nodeDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'node'
                    }
                }
            ],
            name: "Nodes"
        }
    }

    private getDeploymentResourceDefinition() {
        return {
            columns: this.getColumnDef(this.deploymentDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'deployment'
                    }
                }
            ],
            name: "Deployments"
        }
    }

    private getConfigMapsResourceDefinition() {
        return {
            columns: this.getColumnDef(this.configMapDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'configmap'
                    }
                }
            ],
            name: "Config Maps & Secrets"
        }
    }

    private getCronJobsResourceDefinition() {
        return {
            columns: this.getColumnDef(this.cronJobDef),
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
            columns: this.getColumnDef(this.daemonSetDef),
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

    private getServicesResourceDefinition() {
        return {
            columns: this.getColumnDef(this.serviceDef),
            command: [
                {
                    command: this.beService.commands.get_resource,
                    arguments: {
                        kind: 'service'
                    }
                }
            ],
            name: "Services"
        }
    }
}
