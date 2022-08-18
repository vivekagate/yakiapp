import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";

@Component({
    selector: 'app-resource-edit',
    templateUrl: './resource-edit.component.html',
    styleUrls: ['./resource-edit.component.scss']
})
export class ResourceEditComponent {
    resourcedescription: any;

    constructor(private modalService: NgbModal, private beService: TauriAdapter) {

    }

    ngOnInit(): void {
        const deployment = this.beService.storage.metadata.metadata.name;
        setTimeout(() => {
            this.beService.executeSyncCommandInCurrentNs(this.beService.commands.get_deployment, {
                deployment
            }, (res) => {
                const val = JSON.parse(JSON.parse(res).data);
                delete val.metadata.managedFields;
                const op = JSON.stringify(val, null, 4);
                // const op = JSON.parse(res).data;
                this.resourcedescription = `${op}`;
            });
        });
    }

    onApply() {
        console.log(this.resourcedescription);
        this.beService.executeSyncCommandInCurrentNs(this.beService.commands.edit_resource, {
            name: this.beService.storage.metadata.metadata.name,
            kind: this.beService.storage.metadata.kind,
            resource: this.resourcedescription
        }, (res) => {
            this.modalService.dismissAll();
        });
    }

    onDismiss() {
        this.modalService.dismissAll();
    }
}