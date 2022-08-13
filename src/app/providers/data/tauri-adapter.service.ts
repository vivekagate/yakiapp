import { Injectable } from '@angular/core';
import {invoke} from "@tauri-apps/api/tauri";
import {Cache} from "../cache/cache";
import {EventListener} from "../types";
import {appWindow} from "@tauri-apps/api/window";
import * as _ from "lodash";

@Injectable()
export class TauriAdapter {

  public storage: any;
  public commands = {
    execute_sync_command: 'execute_sync_command',
    eula_accepted: 'eula_accepted',
    add_license: 'add_license',
    get_pods_for_deployment: 'get_pods_for_deployment',
    save_preference: 'save_preference',
    get_preferences: 'get_preferences',


    execute_command: 'execute_command',
    get_deployments: 'get_deployments',
    get_resource: 'get_resource',
    get_resource_with_metrics: 'get_resource_with_metrics',
    get_pods_for_deployment_async: 'get_pods_for_deployment_async',
    get_metrics_for_deployment: 'get_metrics_for_deployment',
    get_all_ns: 'get_all_ns',
    get_all_cluster_contexts: 'get_all_cluster_contexts',
    set_current_cluster_context: 'set_current_cluster_context',
    get_current_cluster_context: 'get_current_cluster_context',
    restart_deployments: 'restart_deployments',
    tail_logs_for_pod: 'tail_logs_for_pod',
    get_logs_for_pod: 'get_logs_for_pod',
    get_environment_variables_for_pod: 'get_environment_variables_for_pod',
    stream_metrics_for_pod: 'stream_metrics_for_pod',
    stream_metrics_for_deployment: 'stream_metrics_for_deployment',
    stop_live_tail: 'stop_live_tail',
    app_start: 'app_start',
    stop_all_metrics_streams: 'stop_all_metrics_streams'
  }

  public events = {
    app_events_channel: 'app_events_channel',
    no_cluster_found: 'no_cluster_found',
    no_license_found: 'no_license_found',
    eula_accepted: 'eula_accepted',
    eula_not_accepted: 'eula_not_accepted',

    valid_license_found: 'valid_license_found',
    app_error: 'app::error'
  }

  public ngeventbus = {
    app_events: 'app:events'
  }

  public ngevent = {
    ns_changed: 'ns_changed',
    cluster_changed: 'cluster_changed',
    escape_hit: 'escape_hit'
  }

  public response_channel = {
    app_command_result: 'app::command_result',
    dashboard_error: 'dashboard::error',
    dashboard_logs: 'dashboard::logs',
    app_status_update: 'app::status_update',
    app_metrics: 'app::metrics'
  }

  private eventListeners: Map<any,Map<string, EventListener>>;

  public constructor(private cache: Cache) {
    this.eventListeners = new Map();
    this.initListener().then(() => {
    });
  }

  async initListener() {
    const event_list = [
      this.response_channel.dashboard_error,
      this.response_channel.app_command_result,
      this.response_channel.app_status_update,
      this.response_channel.dashboard_logs,
      this.response_channel.app_metrics,
      this.events.app_events_channel,
      this.events.no_cluster_found,
      this.events.app_error
    ]

    event_list.forEach(eventname => {
      appWindow.listen(eventname, ({event, payload}) => {
        console.debug('Received event: ' + event);
        const nevent = {
          name: eventname,
          payload
        };

        const elMap = this.eventListeners.get(eventname);
        if (elMap) {
          const eventListeners = elMap.values();
          for (const el of eventListeners) {
            el.handleEvent(nevent);
          }
        }

        const command = this.parseCommand(payload);
        this.cache.set(`app_${command}_result`, nevent);
      });
    })
  }


  public registerListener(event: string, el: EventListener) {
    let map = this.eventListeners.get(event);
    if (!map) {
      map = new Map();
      this.eventListeners.set(event, map);
    }
    map.set(el.getName(), el);
  }

  public unRegisterListener(el: EventListener) {
    for (const key of this.eventListeners.keys()) {
      const elMap = this.eventListeners.get(key);
      if (elMap) {
        elMap.delete(el.getName());
      }
    }
  }

  executeCommandInCurrentNs(cmd: string, args: object, force_refresh = false) {
    const nargs = Object.assign(args, {
      ns: this.storage.ns
    });
    this.executeCommand(cmd, nargs, force_refresh);
  }

  executeCommand(cmd: string, args: object, force_refresh = false){
    const result = this.cache.get(`app_${cmd}_result`);
    if (result && !force_refresh) {
      const elMap = this.eventListeners.get(this.response_channel["app_command_result"]);
      if (elMap) {
        const eventListeners = elMap.values();
        for (const el of eventListeners) {
          el.handleEvent(result);
        }
      }
    }else{
      console.debug('Sending command: ' + cmd);
      setTimeout(() => {
        invoke(this.commands.execute_command, {
          commandstr: JSON.stringify({
            command: cmd,
            args: args,
          })
        }).then(() => {
        });
      }, 50);
    }
  }

  executeSyncCommandInCurrentNs(cmd: string, args: object, callback: (res: any)=>void = (res)=>{}){
    const nargs = Object.assign(args, {
      ns: this.storage.ns
    });

    this.executeSyncCommand(cmd, nargs, callback);
  }

  executeSyncCommand(cmd: string, args: object, callback: (res: any)=>void = (res)=>{}){
    setTimeout(() => {
      invoke(this.commands.execute_sync_command, {
        commandstr: JSON.stringify({
          command: cmd,
          args: args,
        })
      }).then((res) => {
        callback(res);
      });
    }, 50);
  }

  private parseCommand(payload: unknown) {
    if (payload) {
      try {
        return _.get(payload, 'command');
      } catch (e) {
        console.error("Failed to parse payload");
        return "UNKNOWN";
      }
    } else {
      console.error("Failed to parse command");
      return "UNKNOWN";
    }
  }
}
