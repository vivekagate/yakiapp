import { Injectable } from '@angular/core';
import {AgGridColumn, ICellRendererAngularComp} from "ag-grid-angular";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import * as _ from 'lodash';
import {Router} from "@angular/router";
import {AgPromise, ICellRendererComp, ICellRendererParams} from "ag-grid-community";
import {Utilities} from "./utilities";
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

    getAge = (params: any) => {
        let eGui = document.createElement('span');
        let age = Utilities.timeAgo(params.data.metadata.creationTimestamp);
        eGui.innerHTML = `${age}`
        return eGui;
    };


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
        ['Age', this.getAge],
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

    podDef = [
        ['Name', 'metadata.name'],
        ['Ready', (params: any) => {
            const cntStatus = params.data.status.containerStatuses;
            let value = 'N/A';
            if (cntStatus && cntStatus.length > 0) {
                if (cntStatus[0].ready) {
                    value = '1/1'
                }else{
                    value = '0/1'
                }
            }
            let eGui = document.createElement('span');
            eGui.innerHTML = `${value}`
            return eGui;
        }],
        ['Status', (params: any) => {
            const cntStatus = params.data.status.containerStatuses;
            let color = '';
            let status = 'Running';
            if (cntStatus && cntStatus.length > 0) {
                    if (cntStatus[0].state?.waiting?.reason) {
                        color = 'link-danger';
                        status = cntStatus[0].state?.waiting?.reason;
                    }
            }
            let eGui = document.createElement('span');
            if (color) {
                eGui.classList.add(color);
                eGui.innerHTML = `${status}&nbsp;&nbsp;<i class='fa fa-warning'></i>`
            }else{
                eGui.innerHTML = `${status}`
            }
            return eGui;
        }],
        ['Restarts', (params: any) => {
            const cntStatus = params.data.status.containerStatuses;
            let value = 0;
            let color = '';
            if (cntStatus && cntStatus.length > 0) {
                try{
                    if (cntStatus[0].restartCount) {
                        value = Number(cntStatus[0].restartCount);
                        if (value > 0 && value <= 5) {
                            color = 'link-warning';
                        }else if (value > 5) {
                            color = 'link-danger';
                        }
                    }
                }catch(e){
                    value = 0;
                }
            }
            let eGui = document.createElement('span');
            if (color) {
                eGui.classList.add(color);
                eGui.innerHTML = `${value}&nbsp;&nbsp;<i class='fa fa-warning'></i>`
            }else{
                eGui.innerHTML = `${value}`
            }
            return eGui;
        }],
        ['Age', this.getAge],
        ['CPU usage (%)', (params: any) => {
            const containers = params.data.spec.containers;
            let value = 0;
            let battery_level = 0;
            let color = '';
            if (containers && containers.length > 0) {
                try{
                    let limit: number;
                    let usage = 0;
                    if (!containers[0].resources.limits) {
                        limit = 9999999999;
                    }else{
                        let mult_factor = 1000000000;
                        if(containers[0].resources.limits.cpu && containers[0].resources.limits.cpu.endsWith('m')) {
                            mult_factor = 1000000;
                        }

                        limit = Number(containers[0].resources.limits.cpu.replace('m','')) * mult_factor;
                    }
                    if (containers[0].resources.usage) {
                        usage = Number(containers[0].resources.usage.cpu.replace('n', ''));
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
        ['Memory usage (%)',  (params: any) => {
            const containers = params.data.spec.containers;
            let value = 0;
            let battery_level = 0;
            let color = '';
            if (containers && containers.length > 0) {
                try{
                    let limit: number;
                    let usage = 0;
                    if (!containers[0].resources.limits) {
                        limit = 9999999999;
                    }else{
                        let mult_factor = 1000000;
                        if(containers[0].resources.limits.memory && containers[0].resources.limits.memory.endsWith('Mi')) {
                            mult_factor = 1000;
                        }else if(containers[0].resources.limits.memory && containers[0].resources.limits.memory.endsWith('Ki')) {
                            mult_factor = 1;
                        }
                        limit = Number(containers[0].resources.limits.memory.replace('Ki','').replace('Mi','').replace('Gi','')) * mult_factor;
                    }
                    if (containers[0].resources.usage) {
                        usage = Number(containers[0].resources.usage.memory.replace('Ki', ''));
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

    configMapDef = [
        ['Name', 'metadata.name'],
        ['Data', ''],
        ['Type', ''],
        ['Age', this.getAge],
    ];

    cronJobDef = [
        ['Name', 'metadata.name'],
        ['Status', (params: any) => {
            let eGui = document.createElement('span');
            eGui.innerHTML = `${params.data.status}`
            return eGui;
        }],
        ['Age', this.getAge],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    serviceDef = [
        ['Name', 'metadata.name'],
        ['Age', (params: any) => {
            let eGui = document.createElement('span');
            eGui.innerHTML = `${params.data.metadata.creationTimestamp}`
            return eGui;
        }],
        ['Age', this.getAge],
        ['Type', 'spec.type'],
        ['ClusterIP', 'spec.clusterIP'],
        ['Port', 'spec.ports.0.port'],
        ['Target Port', 'spec.ports.0.targetPort'],
        ['Node Port', 'spec.ports.0.nodePort'],
    ];

    daemonSetDef = [
        ['Name', 'metadata.name'],
        ['Status', (params: any) => {
            let eGui = document.createElement('span');
            eGui.innerHTML = `${params.data.status}`
            return eGui;
        }],
        ['Age', this.getAge],
        ['CPU Request', 'status.capacity.cpu'],
        ['CPU Allocatable', 'status.allocatable.cpu'],
        ['Memory Request', 'status.capacity.memory'],
        ['Memory Allocatable', 'status.allocatable.memory'],
    ];

    deploymentDef = [
        ['Name', 'metadata.name'],
        ['Status', (params: any) => {
            const replicas = params.data.status.replicas;
            const unavailable = params.data.status.unavailableReplicas;
            const available = params.data.status.availableReplicas;
            let status = 'Stopped';
            let icon = 'fa-stop';
            let color = 'link-secondary';
            if (!params.data.status.replicas && !params.data.status.availableReplicas) {
                status = 'Stopped';
                icon = 'fa-stop';
                color = 'link-secondary';
            }else if (replicas === available) {
                status = 'Running';
                icon = 'fa-check';
                color = 'link-success'
            }else if (unavailable > 0) {
                status = 'Unhealthy';
                icon = 'fa-warning';
                color = 'link-danger';
            }
            let eGui = document.createElement('span');
            eGui.classList.add(color);
            eGui.innerHTML = `<i class='fa ${icon}'></i>&nbsp;${status}`
            return eGui;
        }],
        ['Age', this.getAge],
        ['Pods', (params: any) => {
            let value = 'N/A';
            let replicas = 0;
            if (params.data.status.replicas) {
                replicas = params.data.status.replicas;
            }
            if (params.data.status.availableReplicas) {
                value = `${params.data.status.availableReplicas}/${replicas}`;
            } else {
                value = `0/${replicas}`;
            }
            let eGui = document.createElement('span');
            eGui.innerHTML = `${value}`
            return eGui;
        }],
        ['CPU', 'metadata.name'],
        ['Memory', 'metadata.name'],
    ];

    private getColumneDef(name: string, field: string ): AgGridColumn {
        const col = new AgGridColumn();
        col.field = field;
        col.headerName = name;
        return col;
    }

    private getColumneDefWithValueGetter(name: string, valueGetter: (params:any)=>{} ): AgGridColumn {
        const col = new AgGridColumn();
        col.headerName = name;
        // col.valueGetter = valueGetter
        col.cellRenderer = valueGetter
        return col;
    }

    private instanceOfICellRendererComp(object: any): object is ICellRendererComp {
        return 'member' in object;
    }

    private getColumnDef(args: any) {
        let colDef: AgGridColumn[] = [];
        if (args) {
            for (let i = 0; i < args.length; i++) {
                let col = args[i];
                let name = col[0];
                if (typeof col[1] === 'string') {
                    colDef.push(this.getColumneDef(name, col[1]));
                }else if((typeof col[1] === 'object')){
                    // colDef.push(this.getColumneDef(name, col[1]));
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
                    command: this.beService.commands.get_resource_with_metrics,
                    arguments: {
                        kind: 'pod'
                    }
                },
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
                {
                    name: 'edit',
                    displayName: 'Edit Yaml',
                    icon: 'fa-file',
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
