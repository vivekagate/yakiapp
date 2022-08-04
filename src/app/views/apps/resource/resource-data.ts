import { Injectable } from '@angular/core';
import {AgGridColumn} from "ag-grid-angular";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import * as _ from 'lodash';
import {Router} from "@angular/router";
// import * as moment from 'moment';

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
    resource_field: string;
}

export interface Section {
    name: string;
    attributes: Attribute[];
    hidden?: boolean;
}
export interface Resource {
    name?: string;
    columns: AgGridColumn[];
    command?: Command[];
    actions?: Action[];
    sections?: Section[];
}

@Injectable({
    providedIn: 'any'
})
export class ResourceData {
    constructor(private beService: TauriAdapter, private router: Router) {
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
        ['Age', (d: any) => d.data.metadata.creationTimestamp],
        ['Type', 'spec.type'],
        ['ClusterIP', 'spec.clusterIP'],
        ['Port', 'spec.ports.0.port'],
        ['Target Port', 'spec.ports.0.targetPort'],
        ['Node Port', 'spec.ports.0.nodePort'],
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
            name: "Pods",
            actions: [
                {
                    name: 'logs',
                    displayName: 'Logs',
                    icon: 'fa-file-code-o',
                    callback: (resource: any) => {
                        console.log('Get Logs');
                    }
                },
                {
                    name: 'restart',
                    displayName: 'Restart',
                    icon: 'fa-term',
                    callback: (resource: any) => {
                        console.log('Restart');
                    }
                },
                {
                    name: 'shell',
                    displayName: 'Shell',
                    icon: 'fa-term',
                    callback: (resource: any) => {
                        console.log('Open Shell');
                    }
                },
            ]
        }
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
            name: "Deployments",
            actions: [
                {
                    name: 'logs',
                    displayName: 'Logs',
                    icon: 'fa-file-code-o',
                    callback: (resource: any)=>{
                        const appname = _.get(resource, 'metadata.name');
                        console.log('Requesting logs for: ' + appname);
                        this.beService.storage = Object.assign(this.beService.storage, {
                            appname: appname
                        })
                        this.router.navigateByUrl('/logs');
                    }
                },
                {
                    name: 'restart',
                    displayName: 'Restart',
                    icon: 'fa-term',
                    callback: (resource: any)=>{
                        const appname = _.get(resource, 'metadata.name');
                        this.beService.executeCommandInCurrentNs(this.beService.commands.restart_deployments, {
                            deployment: appname,
                        });
                    }
                },
                {
                    name: 'shell',
                    displayName: 'Shell',
                    icon: 'fa-term',
                    callback: ()=>{}
                },
            ]
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
