import {Component, HostListener, Input, NgZone} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { ClassToggleService, HeaderComponent } from '@coreui/angular';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {appWindow} from "@tauri-apps/api/window";
import * as _ from "lodash";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {EventListener} from "../../../providers/types";
import {NgEventBus} from "ng-event-bus";

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
})
export class DefaultHeaderComponent extends HeaderComponent implements EventListener {

  @Input() sidebarId: string = "sidebar";

  clusters: {
    name: string,
    current: boolean
  }[];

  namespaces: {
    name: string
  }[];
  selectedNs: {
    name: string
  };

  public newMessages = new Array(4)
  public newTasks = new Array(5)
  public newNotifications = new Array(5)
  cluster_found = false;
  selectedCluster: {
    name: string
  };

  constructor(private ngZone: NgZone, private classToggler: ClassToggleService, private beService: TauriAdapter, private modalService: NgbModal, private eventBus: NgEventBus) {
    super();
    this.namespaces = [];
    this.clusters = [];
    this.selectedNs = {
      name: "default"
    };

    this.selectedCluster = {
      name: ''
    }
  }

  getName(): string {
      return 'default-header.component.ts';
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    this.eventBus.cast(this.beService.ngeventbus.app_events, this.beService.ngevent.escape_hit);
  }

  ngOnInit() {
    this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    this.beService.registerListener(this.beService.events.app_events_channel, this);
    this.beService.registerListener(this.beService.events.app_error, this);
    this.beService.executeCommand(this.beService.commands.app_start, {});
    this.getAllNamespaces();
    this.getAllClusters();
  }


  getAllNamespaces(refresh = false) {
    this.beService.executeCommand(this.beService.commands.get_all_ns, {}, refresh);
  }

  private getAllClusters() {
    this.beService.executeSyncCommand(this.beService.commands.get_all_cluster_contexts, {}, (res) => {
      const config = JSON.parse(JSON.parse(res).data);
      this.ngZone.run(() => {
        console.log(config);
        this.clusters = config.clusters;
        this.clusters.forEach((cl) => {
          if (cl.name === config['current-context']) {
            this.selectedCluster = cl;
          }
        })
      });
    });
  }
  async initListener() {
    await appWindow.listen(this.beService.events.app_events_channel, ({event, payload}) => {

    });
  }

  showKubeConfigFileMissing(content: any) {
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title'}).result.then((result) => {
    }, (reason) => {
      // this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  onNamespaceChanged() {
    this.beService.storage = Object.assign({}, this.beService.storage, {ns: this.selectedNs.name});
    this.beService.storage.ns = this.selectedNs.name;
    this.eventBus.cast(this.beService.ngeventbus.app_events, this.beService.ngevent.ns_changed);
    // this.getApplications(this.selectedNs.name);
  }

  onClusterChanged() {
    console.log('Changing cluster to: ' + this.selectedCluster.name);
    this.eventBus.cast(this.beService.ngeventbus.app_events, this.beService.ngevent.cluster_changed);
    this.beService.executeSyncCommand(this.beService.commands.set_current_cluster_context, {
      cluster: this.selectedCluster.name.trim()
    }, (res) => {
      console.log(res);
      this.getAllNamespaces(true);
    });
  }



  handleAppStartEvent(event: any, payload: any): void {
    console.log('Received event: ' + event);
    // @ts-ignore
    if (payload && payload['event'] === this.beService.events.no_cluster_found) {
      this.cluster_found = false;
    } else {
      this.cluster_found = true
    }
    this.ngZone.run(() => {
      // this.error = 'Bad query. Check Search query'
    });
  }

  handleEvent(ev: any): void {
    const evname = ev.name;
    const payload = ev.payload;

    if (evname === this.beService.events.app_events_channel) {
      this.handleAppStartEvent(ev, payload);
    }else if (evname === this.beService.events.app_error) {
      alert(payload.reason);
    }else{
      let results: any;
      try {
        results = JSON.parse(_.get(payload, 'data'));
      } catch (e) {
        console.error("Failed to parse payload");
      }

      if (evname === this.beService.response_channel["app_command_result"]) {
        let cmd = _.get(payload, 'command');
        if (cmd === this.beService.commands.get_all_ns) {
          this.ngZone.run(() => {
            this.namespaces = results;
            let ns = this.namespaces.filter((ns) => ns.name === 'default');
            if(ns && ns.length > 0) {
              this.selectedNs = ns[0];
            }else{
              this.selectedNs = this.namespaces[0];
            }
            this.beService.storage = Object.assign({}, this.beService.storage, {ns: this.selectedNs.name});
            this.eventBus.cast(this.beService.ngeventbus.app_events, this.beService.ngevent.ns_changed);
          });
        }
      }
    }
  }

}
