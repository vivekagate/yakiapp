import {Component} from "@angular/core";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {TauriAdapter} from "../../../../providers/data/tauri-adapter.service";
import * as YAML from 'yaml';

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
            this.beService.executeSyncCommandInCurrentNs(this.beService.commands.get_resource_definition, {
                kind: this.beService.storage.metadata.kind,
                name: this.beService.storage.metadata.metadata.name
            }, (res) => {
                const data = JSON.parse(res).data;
                try {
                    const val = JSON.parse(data);
                    delete val.metadata.managedFields;
                    const op = JSON.stringify(val, null, 4);
                    this.resourcedescription = `${op}`;
                }catch(e) {
                    const val = YAML.parse(data);
                    delete val.metadata.managedFields;
                    const op = YAML.stringify(val, null, 4);
                    this.resourcedescription = `${op}`;
                }
            });
        });
    }

    onApply() {
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