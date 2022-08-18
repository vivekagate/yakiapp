import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../../providers/data/tauri-adapter.service";
import * as _ from "lodash";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
    resource: any;

    constructor(private modalService: NgbModal, private beService: TauriAdapter) {

    }

    ngOnInit(): void {
        const deployment = this.beService.storage.metadata.metadata.name;
    }

    onDismiss() {
        this.modalService.dismissAll();
    }

    onConfirm() {
        const resource = this.beService.storage.metadata;
        const appname = _.get(resource, 'metadata.name');
        this.beService.executeCommandInCurrentNs(this.beService.commands.restart_deployments, {
            deployment: appname,
        });
        this.modalService.dismissAll();
    }
}