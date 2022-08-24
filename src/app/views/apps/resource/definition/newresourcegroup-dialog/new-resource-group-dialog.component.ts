import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../../providers/data/tauri-adapter.service";
import * as _ from "lodash";
import {EventListener} from "../../../../../providers/types";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './new-resource-group-dialog.component.html',
    styleUrls: ['./new-resource-group-dialog.component.scss']
})
export class NewResourceGroupDialogComponent implements EventListener{
    resourcedescription: any;
    selectedNs: any;
    namespaces = [];

    constructor(private modalService: NgbModal, private beService: TauriAdapter) {
        this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    }

    ngOnInit(): void {
        console.log('Retrieve template');
        setTimeout(() => {
            this.beService.executeCommandInCurrentNs(this.beService.commands.get_resource_with_metrics, {
                kind: 'Namespace',
            },true);
        })
    }

    onDismiss() {
        this.modalService.dismissAll();
    }

    onApply() {
        this.beService.executeCommand(this.beService.commands.create_resource, {
            resource: this.resourcedescription,
            ns: this.selectedNs.metadata.name,
        }, true);
        this.modalService.dismissAll();
    }

    handleEvent(ev: any): void {
        const evname = ev.name;
        const payload = ev.payload;

        if (evname === this.beService.response_channel.app_command_result) {
            try{
                this.namespaces = JSON.parse(JSON.parse(payload.data).resource).items;
            }catch(e) {
                console.log('Failed to parse namespaces');
            }
        }
    }

    getName(): string {
        return "newresourcegroup"
    }
}