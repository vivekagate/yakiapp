import {Injectable} from "@angular/core";
import * as _ from "lodash";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";
import {ResourceDefinitionCommon} from "./resource-definition-common";
import {Router} from "@angular/router";
import {Utilities} from "../utilities";
import {ColDef} from "ag-grid-community";
import {Resource} from "../resource-data";
import {ResourceEditComponent} from "./resource-edit.component";
import {InstanceDialogComponent} from "./instancedialog/instance-dialog.component";
import {ConfirmDialogComponent} from "./confirmdialog/confirm-dialog.component";
import {NewResourceDialogComponent} from "./newresource-dialog/new-resource-dialog.component";


@Injectable({
    providedIn: 'any'
})
export class DeploymentDefinition {
    constructor(private beService: TauriAdapter, private common: ResourceDefinitionCommon, private router: Router) {
    }

    deploymentStatus = (params: any) => {
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
    };

    deploymentInstances = (params: any) => {
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
    };

    deploymentLastRestart = (params: any) => {
        const containers = params.data.spec.template.spec.containers;
        let value = null;
        if (containers && containers.length > 0) {
            try{
                if (containers[0].resources.usages) {
                    containers[0].resources.usages.forEach((d: any) => {
                        if (d.status.containerStatuses[0].state?.running) {
                            value = new Date(d.status.containerStatuses[0].state?.running?.startedAt);
                        }
                    })
                }

            }catch(e){
                value = '';
            }
        }
        let eGui = document.createElement('span');
        if (value) {
            eGui.innerHTML = `${Utilities.timeAgo(value)}&nbsp;&nbsp;`
        }
        return eGui;
    };

    deploymentRestarts = (params: any) => {
        const containers = params.data.spec.template.spec.containers;
        let color = '';
        let value = 0;
        if (containers && containers.length > 0) {
            try{
                if (containers[0].resources.usages) {
                    containers[0].resources.usages.forEach((d: any) => {
                        value += Number(d.status.containerStatuses[0].restartCount);
                    })
                }
                if (value > 0 && value <= 5) {
                    color = 'link-warning';
                }else if (value > 5) {
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
        eGui.innerHTML = `${value}&nbsp;&nbsp;`
        return eGui;
    };

    applicationDef = [
        ['Name', 'metadata.name'],
        ['Namespace', 'metadata.namespace'],
        ['Status', this.deploymentStatus],
        ['Last Restart', this.deploymentLastRestart],
        ['Restarts', this.deploymentRestarts],
        ['Instances', this.deploymentInstances],
        ['CPU', (params: any) => {
            const containers = params.data.spec.template.spec.containers;
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
                    if (containers[0].resources.usages) {
                        let podcpus = 0;
                        containers[0].resources.usages.forEach((d: any) => {
                            podcpus += Number(d.usage.containers[0].usage.cpu.replace('n', ''));
                        })
                        usage = Math.round(podcpus/containers[0].resources.usages.length);
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
        ['Memory', (params:any) => {
            const containers = params.data.spec.template.spec.containers;
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
                    if (containers[0].resources.usages) {
                        let podmemory = 0;
                        containers[0].resources.usages.forEach((d: any) => {
                            podmemory += Number(d.usage.containers[0].usage.memory.replace('Ki', ''));
                        })
                        usage = Math.round(podmemory/containers[0].resources.usages.length);
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

    podStatus =  (params: any) => {
        const cntStatus = params.data.status.containerStatuses;
        let color = 'link-success';
        let status = 'Running';
        let icon = 'fa-check';
        if (cntStatus && cntStatus.length > 0) {
            if (cntStatus[0].state?.waiting?.reason) {
                color = 'link-danger';
                icon = 'fa-warning';
                status = cntStatus[0].state?.waiting?.reason;
            }
        }
        let eGui = document.createElement('span');
        eGui.classList.add(color);
        eGui.innerHTML = `<i class='fa ${icon}'>&nbsp;&nbsp;${status}</i>`
        return eGui;
    };

    podStartTime =  (params: any) => {
        const startTime = params.data.status.startTime;
        let value = Utilities.timeAgo(new Date(startTime));
        let eGui = document.createElement('span');
        eGui.innerHTML = `${value}`
        return eGui;
    };

    podCpu = (params: any) => {
        let value = 0;
        let battery_level = 0;
        let color = '';
        if (params.data.spec && params.data.spec.containers) {
            const containers = params.data.spec.containers;
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
        }
        let eGui = document.createElement('span');
        if (color) {
            eGui.classList.add(color);
        }
        eGui.innerHTML = `${value}%&nbsp;&nbsp;<i class='fa fa-battery-${battery_level} fa-rotate-270'></i>`
        return eGui;
    };

    podMemory =  (params: any) => {
        let value = 0;
        let battery_level = 0;
        let color = '';
        if (params.data.spec && params.data.spec.containers){
            const containers = params.data.spec.containers;
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
        }
        let eGui = document.createElement('span');
        if (color) {
            eGui.classList.add(color);
        }
        eGui.innerHTML = `${value}%&nbsp;&nbsp;<i class='fa fa-battery-${battery_level} fa-rotate-270'></i>`
        return eGui;
    };

    podRestarts = (params: any) => {
        let value = 0;
        let color = '';
        if (params.data.status.containerStatuses) {
            const cntStatus = params.data.status.containerStatuses;
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
        }
        let eGui = document.createElement('span');
        if (color) {
            eGui.classList.add(color);
            eGui.innerHTML = `${value}&nbsp;&nbsp;<i class='fa fa-warning'></i>`
        }else{
            eGui.innerHTML = `${value}`
        }
        return eGui;
    }

    nsDef = [
        ['Name', 'metadata.name'],
        ['Status', 'status.phase'],
        ['Age', this.common.getAge],
    ];

    podDef = [
        ['Name', 'metadata.name'],
        ['Namespace', 'metadata.namespace'],
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
        ['Status', this.podStatus],
        ['Restarts', this.podRestarts],
        ['Age', this.common.getAge],
        ['CPU usage (%)', this.podCpu],
        ['Memory usage (%)', this.podMemory],
    ];

    deploymentDef = [
        ['Name', 'metadata.name'],
        ['Namespace', 'metadata.namespace'],
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
        ['Age', this.common.getAge],
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
        ['CPU', (params: any) => {
            const containers = params.data.spec.template.spec.containers;
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
                    if (containers[0].resources.usages) {
                        let podcpus = 0;
                        containers[0].resources.usages.forEach((d: any) => {
                            podcpus += Number(d.usage.containers[0].usage.cpu.replace('n', ''));
                        })
                        usage = podcpus;
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
        ['Memory', (params:any) => {
            const containers = params.data.spec.template.spec.containers;
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
                    if (containers[0].resources.usages) {
                        let podmemory = 0;
                        containers[0].resources.usages.forEach((d: any) => {
                            podmemory += Number(d.usage.containers[0].usage.memory.replace('Ki', ''));
                        })
                        usage = podmemory;
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


    getDeploymentResourceDefinition() {
        return {
            columns: this.common.getColumnDef(this.deploymentDef),
            command: [
                {
                    command: this.beService.commands.get_resource_with_metrics,
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
                    name: 'edit',
                    displayName: 'Edit',
                    icon: 'fa-file',
                    callback: (res: any)=>{
                        this.beService.storage.metadata = res;
                        return {
                            ui: ResourceEditComponent,
                            size: 'lg'
                        };
                    }
                },
            ],
            sections: [
                {
                    name: 'Overview',
                    attributes: [
                        {
                            name: 'Image',
                            resource_field: 'spec.template.spec.containers.0.image'
                        },
                        {
                            name: 'CPU Max',
                            resource_field: 'spec.template.spec.containers.0.resources.limits.cpu'
                        },
                        {
                            name: 'Memory Max',
                            resource_field: 'spec.template.spec.containers.0.resources.limits.memory'
                        },
                    ]
                },
            ]
        }
    }

    getNamespacesResourceDefinition(): Resource {
        return {
            columns: this.common.getColumnDef(this.nsDef),
            command: [
                {
                    command: this.beService.commands.get_resource_with_metrics,
                    arguments: {
                        kind: 'namespace'
                    }
                },
            ],
            name: "Namespaces",
            resourceListActions: [
                {
                    name: 'addNs',
                    displayName: 'Create New',
                    icon: 'fa-plus',
                    callback: (resource: any) => {
                        this.beService.storage = Object.assign(this.beService.storage, {
                            metadata: {
                                kind: 'Namespace'
                            }
                        });
                        return {
                            ui: NewResourceDialogComponent,
                            size: 'lg'
                        }
                    }
                },
            ],
            actions: [
                {
                    name: 'edit',
                    displayName: 'Edit',
                    icon: 'fa-term',
                    callback: (resource: any) => {
                        console.log('Delete');
                    }
                },
                {
                    name: 'delete',
                    displayName: 'Delete',
                    icon: 'fa-term',
                    callback: (resource: any) => {
                        console.log('Deleting resource');
                        this.beService.executeCommand(this.beService.commands.delete_resource, {
                            name: resource.metadata.name,
                            kind: resource.kind,
                        }, true);
                    }
                },
            ],
            sections: [
                {
                    name: 'Overview',
                    attributes: [
                        {
                            name: 'Name',
                            resource_field: 'metadata.name'
                        },
                    ]
                },
            ]
        }
    }


    getPodResourceDefinition(): Resource {
        return {
            columns: this.common.getColumnDef(this.podDef),
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
            ],
            sections: [
                {
                    name: 'Overview',
                    attributes: [
                        {
                            name: 'Image',
                            resource_field: 'spec.template.spec.containers.0.image'
                        },
                    ]
                },
            ]
        }
    }

    getApplicationResourceDefinition() {
        return {
            columns: this.common.getColumnDef(this.applicationDef),
            command: [
                {
                    command: this.beService.commands.get_resource_with_metrics,
                    arguments: {
                        kind: 'deployment'
                    }
                }
            ],
            name: "Applications",
            actions: [
                {
                    name: 'instance',
                    displayName: 'Change instance',
                    icon: 'fa-file-code-o',
                    callback: (res: any)=>{
                        this.beService.storage.metadata = res;
                        return {
                            ui: InstanceDialogComponent,
                            size: 'lg'
                        };
                    }
                },
                {
                    name: 'restart',
                    displayName: 'Restart',
                    icon: 'fa-term',
                    callback: (res: any)=>{
                        this.beService.storage.metadata = res;
                        return {
                            ui: ConfirmDialogComponent,
                            size: 'sm'
                        };
                    }
                },
                {
                    name: 'metrics',
                    displayName: 'Logs + Metrics',
                    icon: 'fa-file-code-o',
                    callback: (resource: any)=>{
                        const appname = _.get(resource, 'metadata.name');
                        console.log('Requesting logs for: ' + appname);
                        this.beService.storage = Object.assign(this.beService.storage, {
                            appname: appname,
                            metadata: resource
                        })
                        this.router.navigateByUrl('/debug');
                    }
                },
            ],
            sidebar: {
                name: 'Instances',
                mode: 'table',
                data: {
                    rows: [],
                    cols: this.getApplicationColumns(),
                    defcols: this.getDefaultApplicationColumns()
                }
            },
            sections: [
                {
                    name: 'Overview',
                    attributes: [
                        {
                            name: 'Image',
                            resource_field: 'spec.template.spec.containers.0.image'
                        },
                    ]
                },
            ]
        }
    }

    private getDefaultApplicationColumns() {
        return {
            editable: false,
            sortable: true,
            flex: 1,
            minWidth: 100,
            filter: true,
            resizable: true,
        };

    }

    applicationDetailsColumnDef = [
        ['Name', 'metadata.name'],
        ['Status', this.podStatus],
        ['Last Restart', this.podStartTime],
        ['Restarts', this.podRestarts],
        ['CPU', this.podCpu],
        ['Memory', this.podMemory],
    ];


    private getApplicationColumns() {
        return this.common.getColumnDef(this.applicationDetailsColumnDef);
    }
}