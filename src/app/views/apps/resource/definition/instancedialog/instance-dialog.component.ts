import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../../providers/data/tauri-adapter.service";
import {ColDef} from "ag-grid-community";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './instance-dialog.component.html',
    styleUrls: ['./instance-dialog.component.scss']
})
export class InstanceDialogComponent {
    resource: any;
    defaultColDef: ColDef = {
        editable: false,
        sortable: true,
        flex: 1,
        minWidth: 100,
        filter: true,
        resizable: true,
    };

    columnDefs = [
        { field: 'key', headerName: 'Name', editable: false },
        { field: 'value', headerName: 'Value', editable: true },
    ];
    rowData: any[] = [];

    constructor(private modalService: NgbModal, private beService: TauriAdapter) {

    }

    ngOnInit(): void {
        const deployment = this.beService.storage.metadata.metadata.name;
        this.beService.executeSyncCommandInCurrentNs(this.beService.commands.get_deployment, {
            deployment
        }, (res) => {
            this.resource = JSON.parse(JSON.parse(res).data);

            const tblData = [];
            tblData.push({
                key: 'Instances',
                value: this.resource.spec.replicas
            });

            tblData.push({
                key: 'Min Instances',
                value: this.resource.spec.replicas
            });

            tblData.push({
                key: 'Max Instances',
                value: this.resource.spec.replicas
            });

            this.rowData = tblData;
        });
    }

    onApply() {
        this.beService.executeSyncCommandInCurrentNs(this.beService.commands.edit_resource, {
            name: this.beService.storage.metadata.metadata.name,
            kind: this.beService.storage.metadata.kind,
            resource: JSON.stringify(this.resource)
        }, (res) => {
            this.modalService.dismissAll();
        });
    }

    onDismiss() {
        this.modalService.dismissAll();
    }

    onSave() {
        console.log(this.rowData);
    }
}