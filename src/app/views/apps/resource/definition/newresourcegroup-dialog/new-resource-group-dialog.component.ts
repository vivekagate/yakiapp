import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../../providers/data/tauri-adapter.service";
import * as _ from "lodash";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './new-resource-group-dialog.component.html',
    styleUrls: ['./new-resource-group-dialog.component.scss']
})
export class NewResourceGroupDialogComponent {
    resourcedescription: any;
    selectedNs: any;
    namespaces = [];

    constructor(private modalService: NgbModal, private beService: TauriAdapter) {

    }

    ngOnInit(): void {
        console.log('Retrieve template');
        setTimeout(() => {
            this.beService.executeSyncCommandInCurrentNs(this.beService.commands.get_resource_with_metrics, {
                kind: 'Namespace',
            }, (res: any) => {
                const val = JSON.parse(res).data;
                console.log(val);
                // const op = JSON.stringify(val, null, 4);
                // this.resourcedescription = `${val}`;
            });
        })
    }

    onDismiss() {
        this.modalService.dismissAll();
    }

    onApply() {
        this.beService.executeCommand(this.beService.commands.create_resource, {
            resource: this.resourcedescription,
            kind: this.beService.storage.metadata.kind,
        }, true);
        this.modalService.dismissAll();
    }

}