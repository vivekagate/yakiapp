import {Component, NgZone} from '@angular/core';
import * as _ from 'lodash';

export enum VIEW_MODE {
  APPS,
  DEPLOYMENTS,
  PODS,

}
@Component({
  selector: 'app-applications',
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.scss']
})
export class ApplicationsComponent implements EventListener{
  deployments: {
    metadata: any;
    deployment: any,
    name: string,
    replicas: number,
    ready_replicas: number,
    unavailable_replicas: number,
    available_replicas: number,
    creation_ts: number,
    restart_ts: number,
    reason: string,
    ns: string,
    status: any
  }[];
  error: string | undefined;
  namespaces: {
    name: string
  }[];
  selectedNs: {
    name: string
  };



  isLoading = true;
  isEnvsLoading = false;
  isMetricsLoading = false;

  faCircleCheck = faCircleCheck;
  faCircleX = faCircleXmark;
  faCircleWarn = faCircleExclamation;
  faTailLog = faFileLines;
  faRestart = faArrowsRotate;
  faTerminal = faTerminal;
  faLoading = faSpinner;
  faClose = faChevronRight;
  faCross = faXmark;
  faCheck = faCheck;
  faStopped = faStop;

  isSideBarHidden = true;
  selectedapp: any;
  envs: {
    name: string,
    value: string
  }[] = [];

  constructor(private ngZone: NgZone, private router: Router, private beService: TauriAdapter, private eventBus: NgEventBus) {
    this.deployments = [];
    this.namespaces = [];
    this.selectedNs = {
      name: 'default'
    };
  }

  ngOnInit() {
    this.beService.registerListener(this.beService.response_channel.app_command_result, this);
    this.getAllNamespaces();
    this.getApplications(this.selectedNs.name);
    this.eventBus.on(this.beService.ngeventbus.app_events).subscribe((meta: MetaData) => {
      if (meta.data === this.beService.ngevent.ns_changed) {
        this.onNamespaceChanged();
      }else if (meta.data === this.beService.ngevent.escape_hit) {
        if ( ! this.isSideBarHidden) {
          this.isSideBarHidden = true;
        }
      }
    });
  }

  async initListener() {
    await appWindow.listen("dashboard::error", ({event, payload}) => {
      console.log('Received event: ' + event);
      this.ngZone.run(() => {
        this.deployments = [];
        this.error = 'Bad query. Check Search query'
      });
    });

    appWindow.listen("app::status_update", ({event, payload}) => {

    });

    appWindow.listen("app::command_result", ({event, payload}) => {

    });
  }

  getApplications(namespace: string, force_refresh = false) {
    this.beService.executeCommand(this.beService.commands.get_deployments, {
      ns: namespace
    }, force_refresh)
  };

  getName(): string {
    return 'application.component.ts';
  }

  getAllNamespaces() {
    this.beService.executeCommand(this.beService.commands.get_all_ns, {});
  }

  taillogs(appname: string) {
    console.log('Requesting logs for: ' + appname);
    this.beService.storage = {
      appname: appname,
      ns: this.selectedNs.name
    }
    this.router.navigateByUrl('/logs');
  }

  restart(name: string) {
    this.beService.executeCommand(this.beService.commands.restart_deployments, {
      deployment: name,
      ns: this.selectedNs.name
    });
  }

  onNamespaceChanged() {
    this.isLoading = true;
    this.getApplications(this.beService.storage.ns || 'default', true);
  }

  handleEvent(ev: any): void {
    const evname = ev.name;
    const payload = ev.payload;

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
        });
      } else if (cmd === this.beService.commands.get_deployments) {
        results.items.forEach((res: any) => {
          if ((res.status.availableReplicas === 0) && (res.status.replicas > 0)) {
            res.status = 'down';
            res.reason = '--';
          }else if (res.status.availableReplicas === res.status.replicas) {
            res.status = 'up';
          }else{
            res.status = 'down';
            res.reason = '--';
          }

          let max_cpu = _.get(res, 'spec.template.spec.containers[0].resources.limits.cpu', '');
          if (max_cpu) {
            if (max_cpu.indexOf('m') >= 0) {
              res.spec.template.spec.containers[0].resources.limits.cpu_in_nanocore = Number(max_cpu.replace('m', '')) * 1000000;
            } else if (max_cpu.indexOf('n') >= 0) {
              res.spec.template.spec.containers[0].resources.limits.cpu_in_nanocore = Number(max_cpu.replace('n', ''));
            } else {
              res.spec.template.spec.containers[0].resources.limits.cpu_in_nanocore = Number(max_cpu) * 1000000000;
            }
          } else {
            _.set(res, 'spec.template.spec.containers[0].resources.limits.cpu_in_nanocore', 'N/A');
          }
        })
        this.ngZone.run(() => {
          this.deployments = results.items;
          this.isLoading = false;
        });
      } else if (cmd === this.beService.commands.get_pods_for_deployment_async) {
        console.log(results);
        if (results && results.length > 0) {
          const pod = results[0];
          this.ngZone.run(() => {
            this.envs = pod.spec.containers[0].env;
            this.isEnvsLoading = false;
          });
        }
      } else if (cmd === this.beService.commands.get_metrics_for_deployment) {
        if (results && results.length > 0) {
          let tot_cpu = 0;
          let tot_mem = 0;
          results.forEach((metric: any) => {
            tot_cpu += Number(metric.cpu.replace('n', ''));
            tot_mem += Number(metric.memory.replace('Ki', '').replace('Mi', ''));
          });
          let cpu_percent = 0;
          let mem_percent = 0;
          try{
            this.ngZone.run(() => {
              this.selectedapp.total_cpu = tot_cpu;
              this.selectedapp.total_memory = tot_mem;
              this.selectedapp.total_cpu_percent = (tot_cpu*100)/this.selectedapp?.deployment?.spec?.template?.spec?.containers[0].resources?.limits?.cpu_in_nanocore;
              this.selectedapp.total_memory_percent = mem_percent;
              this.isMetricsLoading = false;
            });
            let max_mem = this.selectedapp?.deployment?.spec?.template?.spec?.containers[0].resources?.limits?.memory;
          }catch(e) {

          }
        }
      }
    }else if (evname === this.beService.response_channel.app_status_update) {
      console.log('Status updated: ' + payload);
      this.ngZone.run(() => {
        this.deployments.forEach((deploy) => {
          if (deploy.name === results.name) {
            deploy.reason = results.reason;
          }
        });
      });
    }
    if (payload) {

      try {
        let results = JSON.parse(_.get(payload, 'data'));
        console.log(results);

      } catch (e) {
        console.error("Failed to parse payload");
      }
    } else {
      console.error("Invalid format");
    }
  }

  onSelect(app: string) {
    this.deployments.forEach((d) => {
      if (d.deployment.metadata.name === app) {
        this.selectedapp = d;
        this.resetMetrics();
      }
    });
    this.envs = [];
    this.isSideBarHidden = !this.isSideBarHidden;
    if (!this.isSideBarHidden) {
      this.isEnvsLoading = true;
      this.beService.executeCommand(this.beService.commands.get_pods_for_deployment_async, {
        ns: this.selectedNs.name,
        deployment: app
      }, true);

      this.isMetricsLoading = true;
      this.beService.executeCommand(this.beService.commands.get_metrics_for_deployment, {
        ns: this.selectedNs.name,
        deployment: app
      }, true);
    }
  }

  getAccordionBodyText(first: string) {
    return first;
  }

  getCurrentDate() {
    return new Date().toLocaleString();
  }

  getColor(val: number) {
    if (val) {
      if (val < 60) {
        return 'success';
      }
      if (val < 80) {
        return 'warning';
      }
      return 'danger';
    }
    return 'secondary';
  }

  private resetMetrics() {
    this.selectedapp.total_memory = 'N/A';
    this.selectedapp.total_cpu = 'N/A';
    this.selectedapp.total_memory_percent = 'N/A';
    this.selectedapp.total_cpu_percent = 'N/A';
  }

  showResourceDetails(cpu: string) {

  }
}
import {appWindow} from "@tauri-apps/api/window";
import { Router } from '@angular/router';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {
  faArrowsRotate,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faFileLines, faTerminal,
  faSpinner, faXmark, faCheck,
  faChevronRight, faStop
} from '@fortawesome/free-solid-svg-icons';


import {EventListener} from "../../../providers/types";
import {NgEventBus} from "ng-event-bus";
import {MetaData} from "ng-event-bus/lib/meta-data";
