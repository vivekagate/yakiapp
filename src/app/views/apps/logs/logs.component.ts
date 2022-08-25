import {Component, ElementRef, NgZone, ViewChild, ViewChildren} from '@angular/core';
import * as _ from 'lodash';
import {invoke} from '@tauri-apps/api/tauri';
import {appWindow} from "@tauri-apps/api/window";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {TerminalComponent} from "./terminal/terminal.component";
import {
  DisplayGrid,
  GridsterConfig,
  GridsterItem,
  GridsterItemComponentInterface,
  GridType
} from "angular-gridster2";
import {EventListener} from "../../../providers/types";

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
})
export class LogsComponent implements EventListener{
  deployments: {
    name: string,
    replicas: number
  }[];
  error: string | undefined;
  appname: string = '';
  @ViewChildren("logterminal")
  logterminals: TerminalComponent[] | undefined;
  logterminalMap: Map<string, TerminalComponent> | undefined;
  logs_viewport: Array<GridsterItem> = [];
  // @ts-ignore
  options: GridsterConfig;

  pods: any[] = [];
  mode = 'single';
  isLogStreamPaused = false;
  color_pallete: string[] = ['#150050', '#A12568', '#FEC260', '#D8E9A8', '#1597BB'];
  searchTerm = '';

  constructor(private ngZone: NgZone, private data: TauriAdapter) {
    this.deployments = [];
  }

  static itemChange(item: GridsterItem, itemComponent: GridsterItemComponentInterface) {
    // console.info('itemChanged', item, itemComponent);
    item['bounds'] = {
      top: itemComponent.top,
      left: itemComponent.left,
      height: itemComponent.height,
      width: itemComponent.width
    }
  }

  static itemResize(item: GridsterItem, itemComponent: GridsterItemComponentInterface) {
    // console.info('itemResized', item, itemComponent);
    item['bounds'] = {
      top: itemComponent.top,
      left: itemComponent.left,
      height: itemComponent.height,
      width: itemComponent.width
    }
  }

  static eventStop(item: GridsterItem, itemComponent: GridsterItemComponentInterface, event: MouseEvent): void {
    // console.info('eventStop', item, itemComponent, event);
  }

  static eventStart(item: GridsterItem, itemComponent: GridsterItemComponentInterface, event: MouseEvent): void {
    // console.info('eventStart', item, itemComponent, event);
  }

  ngOnInit() {
    this.data.registerListener(this.data.response_channel.dashboard_logs, this);
    console.log('Get logs');
    this.options = {
      itemChangeCallback: LogsComponent.itemChange,
      itemResizeCallback: LogsComponent.itemResize,
      gridType: GridType.Fit,
      displayGrid: DisplayGrid.OnDragAndResize,
      draggable: {
        enabled: true
      },
      resizable: {
        delayStart: 0,
        enabled: true,
        start: LogsComponent.eventStart,
        stop: LogsComponent.eventStop,
        handles: {
          s: true,
          e: true,
          n: true,
          w: true,
          se: true,
          ne: true,
          sw: true,
          nw: true
        }
      },
    };

    if (this.data.storage && this.data.storage.appname) {
      this.appname = this.data.storage.appname;
      console.log(this.data.storage.appname);
      this.data.executeSyncCommandInCurrentNs(this.data.commands.get_pods_for_deployment, {
        deployment: this.data.storage.appname,
      }, (res) => {
        if (res) {
          try{
            this.pods = JSON.parse(JSON.parse(res).data);
            if (this.mode !== 'single') {
              this.pods.forEach((pod) => {
                const podname = _.get(pod, 'metadata.name', 'Pod');
                this.addTerminal(podname);
              })
            }else{
              this.addTerminal(this.appname);
            }

            this.streamLogs(false);
          }catch(e){
            console.log('Failed to parse response from backend');
          }
        }
      });
    }
  }

  streamLogs(islive: boolean): void {
    if (this.mode !== 'single') {
      this.pods.forEach((pod) => {
        const podname = _.get(pod, 'metadata.name', 'Pod');
        this.taillogs(podname, islive);
      })
    }else{
      this.pods.forEach((pod) => {
        const podname = _.get(pod, 'metadata.name', 'Pod');
        this.taillogs(podname, islive);
      })
    }
  }

  ngOnDestroy(): void {
    console.debug('Stop all streams');
    this.data.executeCommand(this.data.commands.stop_live_tail, {});
    this.data.unRegisterListener(this);
  }

  addTerminal(name: string) {
    this.logs_viewport.push({x: 0, y: 0, cols: 1, rows: 1, content: 'terminal', name: name});
    return name;
  }

  taillogs(podname: string, livetail = false) {
    console.log('Requesting logs for: ' + podname);
    if (podname) {
      if (livetail) {
        this.data.executeCommand(this.data.commands.tail_logs_for_pod, {
          pod: podname,
          ns: this.data.storage.ns
        });
      }else{
        this.data.executeCommand(this.data.commands.get_logs_for_pod, {
          pod: podname,
          ns: this.data.storage.ns
        });
      }
    }
  }

  clear() {
    this.logterminals?.forEach((term) => {
      term.clear();
    });
  }

  getName(): string {
    return "logs.component";
  }

  getColor(data: string): string {
    var hash = 0, i, chr;
      if (data.length === 0) return this.color_pallete[0];
      for (i = 0; i < data.length; i++) {
        chr   = data.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }
      return this.color_pallete[Math.abs(hash) % this.color_pallete.length];
  }

  handleEvent(ev: any): void {
    if (this.isLogStreamPaused) {
      return;
    }
    const event = ev.event;
    const payload = ev.payload;
    if (payload) {
      try {
        let log = _.get(payload, 'message');
        let podname = _.get(payload, 'metadata');
        let original_pod_name = _.get(payload, 'metadata');
        if (!this.logterminalMap) {
          this.logterminalMap = new Map<string, TerminalComponent>();
          this.logterminals?.forEach((tc) => {
            this.logterminalMap?.set(tc.name, tc);
          })
        }

        if(this.mode === 'single') {
          podname = this.appname;
        }
        const terminal = this.logterminalMap.get(podname);
        const color = this.getColor(original_pod_name);
        if (terminal) {
          const lines = log.split('\n');
          lines.forEach((line: string) => {
            if (this.searchTerm && line.indexOf(this.searchTerm) < 0) {
              return;
            }
            terminal.appendContent({
              source: original_pod_name,
              log: line,
              color
            });
          })
        }else{
          console.log('Terminal not found for: ' + podname);
        }
      } catch (e) {
        console.error("Failed to parse payload");
      }
    } else {
      console.error("Invalid format");
    }
  }

  liveTail() {
    this.clear();
    this.isLogStreamPaused = false;
    this.streamLogs(true);
  }

  pause() {
    this.isLogStreamPaused = true;
  }
}
