import { Injectable } from '@angular/core';
import {AgGridColumn} from "ag-grid-angular";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";

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

    private getPodResourceDefinition(): Resource {
        return {
            columns: [],
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

    private getNodeResourceDefinition(): Resource {
        return {
            columns: [],
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
            columns: [],
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
            columns: [],
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
            columns: [],
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
            columns: [],
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
            columns: [],
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
