import {Injectable} from "@angular/core";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";
import {Utilities} from "../utilities";
import {AgGridColumn} from "ag-grid-angular";

@Injectable({
    providedIn: 'any'
})
export class ResourceDefinitionCommon {
    constructor(private beService: TauriAdapter) {
    }

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

    getColumnDef(args: any) {
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

    getAge = (params: any) => {
        let eGui = document.createElement('span');
        let age = Utilities.timeAgo(params.data.metadata.creationTimestamp);
        eGui.innerHTML = `${age}`
        return eGui;
    };

}