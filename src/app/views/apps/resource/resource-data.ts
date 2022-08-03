import { Injectable } from '@angular/core';
import {AgGridColumn} from "ag-grid-angular";

export interface Resource {
    name?: string;
    columns: AgGridColumn[];
    command?: string;
}

@Injectable({
    providedIn: 'any'
})
export class ResourceData {
    constructor() {
        this.resourceMap = new Map();
        this.resourceMap.set('pods', this.getPodResourceDefinition());
        this.resourceMap.set('deployments', this.getDeploymentResourceDefinition());
        this.resourceMap.set('configmaps', this.getConfigMapsResourceDefinition());

    }

    public resourceMap: Map<string, Resource> | undefined;

    public getResource(name: string): Resource {
        // @ts-ignore
        return this.resourceMap.get(name);
    }

    private getPodResourceDefinition(): Resource {
        return {
            columns: [],
            command: "",
            name: "Pods"
        }
    }

    private getDeploymentResourceDefinition() {
        return {
            columns: [],
            command: "",
            name: "Deployments"
        }
    }

    private getConfigMapsResourceDefinition() {
        return {
            columns: [],
            command: "",
            name: "Config Maps & Secrets"
        }
    }
}
