import {Injectable} from "@angular/core";
import * as _ from "lodash";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";
import {ResourceDefinitionCommon} from "./resource-definition-common";
import {Router} from "@angular/router";


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

    deploymentRestarts = (params: any) => {
        const containers = params.data.spec.template.spec.containers;
        let color = '';
        let value = 0;
        console.log('Restart count');
        if (containers && containers.length > 0) {
            try{
                if (containers[0].resources.usages) {
                    containers[0].resources.usages.forEach((d: any) => {
                        value += Number(d.status.containerStatuses[0].restartCount);
                    })
                }
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
        eGui.innerHTML = `${value}&nbsp;&nbsp;`
        return eGui;
    };

    applicationDef = [
        ['Name', 'metadata.name'],
        ['Status', this.deploymentStatus],
        ['Last Restart', this.common.getAge],
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
                            name: 'Status',
                            resource_field: (params: any) => this.deploymentStatus({
                                data: params
                            })
                        },
                        {
                            name: 'Restarts',
                            resource_field: (params: any) => this.deploymentRestarts({
                                data: params
                            })
                        },
                        {
                            name: 'Last Restart',
                            resource_field: 'status.nodeInfo.containerRuntimeVersion'
                        },
                        {
                            name: 'Instances (Healthy/Total)',
                            resource_field: (params: any) => this.deploymentInstances({
                                data: params
                            })
                        },
                    ]
                },
                {
                    name: 'Resources',
                    attributes: [
                        {
                            name: 'CPU',
                            resource_field: 'spec.template.spec.containers.0.image'
                        },
                        {
                            name: 'Memory',
                            resource_field: (params: any) => this.deploymentStatus({
                                data: params
                            })
                        }
                    ]
                },
                {
                    name: 'Environment Variables',
                    attributes: [
                        {
                            name: 'Image',
                            resource_field: 'spec.template.spec.containers.0.image'
                        },
                        {
                            name: 'Status',
                            resource_field: (params: any) => this.deploymentStatus({
                                data: params
                            })
                        }
                    ]
                },
            ]
        }
    }

}