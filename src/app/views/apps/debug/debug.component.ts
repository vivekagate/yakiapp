import {Component, ElementRef, NgZone, ViewChild, ViewChildren} from '@angular/core';
import * as _ from 'lodash';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {
  DisplayGrid,
  GridsterConfig,
  GridsterItem,
  GridsterItemComponentInterface,
  GridType
} from "angular-gridster2";
import {DebugChartsData} from "./debug-charts-data";
import {IChartProps} from "./dashboard-charts-data";
import {ChartjsComponent} from "@coreui/angular-chartjs";
import {EventListener} from "../../../providers/types";
import {QuantityUtils} from "./quantity-utils";

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: [],
})

export class DebugComponent implements EventListener{
  public mainChart: IChartProps = {};
  selectedDeployment: any;
  deployments: any;
  // @ts-ignore
  @ViewChild("metricsgraph") metricsgraph: ChartjsComponent;

  constructor(private ngZone: NgZone, private chartsData: DebugChartsData, private beService: TauriAdapter){ }

  ngOnDestroy(): void {
    console.log('Stop all streams');
    this.beService.executeCommand(this.beService.commands.stop_all_metrics_streams, {});
    this.beService.executeCommand(this.beService.commands.stop_live_tail, {});
  }
  ngOnInit(): void {
    this.beService.registerListener(this.beService.response_channel.app_metrics, this);
    if (this.beService.storage && this.beService.storage.appname) {
      this.beService.executeSyncCommand(this.beService.commands.get_pods_for_deployment, {
        deployment: this.beService.storage.appname,
        ns: this.beService.storage.ns
      }, (res) => {
        if (res) {
          try{
            let pods: any[] = JSON.parse(JSON.parse(res).data);
            const spec = pods[0].spec.containers[0];
            console.log(`CPU Max: ${spec.resources.limits.cpu} Memory Max: ${spec.resources.limits.memory}`);
            const cpu_max_chart = QuantityUtils.normalizeCpu(spec.resources.limits.cpu);
            const memory_max_chart = QuantityUtils.normalizeMemory(spec.resources.limits.memory);
            if ((this.mainChart.options.scales.y.max < cpu_max_chart) || (this.mainChart.options.scales.y1.max < memory_max_chart)){
              this.ngZone.run(() => {
                this.mainChart.options.scales.y.max = cpu_max_chart;
                this.mainChart.options.scales.y1.max = memory_max_chart;
                this.metricsgraph.chart.update();
                // this.initCharts(pods[0].spec.containers[0]);
              });
            }
            pods.forEach((pod) => {
              const podname = _.get(pod, 'metadata.name', 'Pod');
              this.beService.executeCommand(this.beService.commands.stream_metrics_for_pod, {
                pod: podname,
                ns: this.beService.storage.ns
              })
            })
          }catch(e){
            console.log('Failed to parse response from backend');
          }
        }
      });
    }

    this.initCharts(1000, 1000);
  }

  initCharts(max_cpu: Number, maxmem: Number): void {
    this.mainChart = this.chartsData.getChart(max_cpu, maxmem);
  }

  getName(): string {
    return 'debug.component.ts';
  }

  onDeploymentChanged() {}

  handleEvent(ev: any): void {
    console.log('Received new metrics');
    const payload = ev.payload;
    const podname = ev.metadata;
    const metric = JSON.parse(payload.message);
    const epoch_ts = metric.ts;
    const cpu = QuantityUtils.normalizeCpu(metric.cpu);
    const memory = QuantityUtils.normalizeMemory(metric.memory);
    console.log(`Adding CPU: ${cpu} and Memory: ${memory}`);
    const label = new Date(JSON.parse(epoch_ts)).toLocaleTimeString();
    // @ts-ignore
    this.metricsgraph.chart.data.labels.push(label);
    // @ts-ignore
    this.metricsgraph.chart.data.datasets[0].data.push(cpu);
    // @ts-ignore
    this.metricsgraph.chart.data.datasets[1].data.push(memory);
    // @ts-ignore
    if (this.metricsgraph.chart.data.labels.length > 20) {
      // @ts-ignore
      this.metricsgraph.chart.data.labels.shift();
      // @ts-ignore
      this.metricsgraph.chart.data.datasets[0].data.shift();
      // @ts-ignore
      this.metricsgraph.chart.data.datasets[1].data.shift();
    }

    this.ngZone.run(() => {
      this.metricsgraph.chart.update();
    });
  }
}
