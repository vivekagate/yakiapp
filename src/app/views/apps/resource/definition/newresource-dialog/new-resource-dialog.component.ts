import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../../providers/data/tauri-adapter.service";
import * as _ from "lodash";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './new-resource-dialog.component.html',
    styleUrls: ['./new-resource-dialog.component.scss']
})
export class NewResourceDialogComponent {
    resourcedescription: any;


    constructor(private modalService: NgbModal, private beService: TauriAdapter) {

    }

    ngOnInit(): void {
        console.log('Retrieve template');
        this.beService.executeSyncCommand(this.beService.commands.get_resource_template, {
            kind: this.beService.storage.metadata.kind,
        }, (res: any) => {
            const val = JSON.parse(res).data;
            const op = JSON.stringify(val, null, 4);
            this.resourcedescription = `${val}`;
        });
    }

    onDismiss() {
        this.modalService.dismissAll();
    }

    onApply() {
        this.beService.executeCommand(this.beService.commands.apply_resource, {
            resource: this.resourcedescription,
            kind: this.beService.storage.metadata.kind,
        }, true);
        this.modalService.dismissAll();
    }

}