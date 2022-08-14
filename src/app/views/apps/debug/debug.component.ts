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
import {ColDef} from "ag-grid-community";
import {TerminalComponent} from "../logs/terminal/terminal.component";
import {MetricUtilities} from "../common/metric-utilities";

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss'],
})

export class DebugComponent implements EventListener{
  public mainChart: IChartProps = {};
  selectedDeployment: any;
  deployments: any;
  // @ts-ignore
  @ViewChild("metricsgraph") metricsgraph: ChartjsComponent;
  defaultColDef: ColDef = {
    editable: false,
    sortable: true,
    flex: 1,
    minWidth: 100,
    filter: true,
    resizable: true,
  };

  columnDefs = [
    { field: 'key', headerName: 'Name' },
    { field: 'value', headerName: 'Value' },
  ];
  rowData: any[] = [];

  constructor(private ngZone: NgZone, private chartsData: DebugChartsData, private beService: TauriAdapter){ }

  ngOnDestroy(): void {
    console.log('Stop all streams');
    this.beService.executeCommand(this.beService.commands.stop_all_metrics_streams, {});
    this.beService.executeCommand(this.beService.commands.stop_live_tail, {});
  }
  ngOnInit(): void {
    this.beService.registerListener(this.beService.response_channel.app_metrics, this);
    this.beService.registerListener(this.beService.response_channel.app_command_result, this);

    if (this.beService.storage && this.beService.storage.appname && this.beService.storage.metadata) {
      const resource = this.beService.storage.metadata;
      const pods = _.get(resource, 'spec.template.spec.pods', []);
      if (pods && pods.length > 0) {
        console.log('Retrieve EV');
        const podname = _.get(pods[0], 'metadata.name', 'Pod');
        this.beService.executeCommandInCurrentNs(this.beService.commands.get_environment_variables_for_pod, {
          pod: podname,
        });

        const spec = pods[0].spec.containers[0];
        if (spec.resources.limits) {
          const cpu_max_chart = QuantityUtils.normalizeCpu(spec.resources.limits.cpu);
          const memory_max_chart = QuantityUtils.normalizeMemory(spec.resources.limits.memory);
          // if ((this.mainChart.options.scales.y.max < cpu_max_chart) || (this.mainChart.options.scales.y1.max < memory_max_chart)){
          //   this.ngZone.run(() => {
          //     this.mainChart.options.scales.y.max = 100;
          //     this.mainChart.options.scales.y1.max = 100;
          //     this.metricsgraph.chart.update();
          //   });
          // }
        }
      }


      this.beService.executeCommandInCurrentNs(this.beService.commands.stream_metrics_for_deployment, {
        deployment: this.beService.storage.appname,
      });
    }

    this.initCharts(100, 100);
  }

  initCharts(max_cpu: Number, maxmem: Number): void {
    this.mainChart = this.chartsData.getChart(max_cpu, maxmem);
  }

  getName(): string {
    return 'debug.component.ts';
  }

  handleCommand(payload: any) {
    if (payload) {
      try {
        let command = _.get(payload, 'command');
        let dataString = _.get(payload, 'data');
        if (command === this.beService.commands.get_environment_variables_for_pod) {
          this.handleEnvironmentVariables(JSON.parse(dataString));
        }else{
          console.log('Command unsupported: ' + command);
        }
      } catch (e) {
        console.error("Failed to parse payload");
      }
    } else {
      console.error("Invalid format");
    }
  }

  handleMetricsEvent(payload: any) {
    if (payload) {
      let metrics = JSON.parse(_.get(payload, 'message'));
      const epoch_ts = metrics.ts;
      const pods = JSON.parse(metrics.usage);
      const deployment = metrics.resource;
      const {cpu, cpupcg, memory, mempcg} = MetricUtilities.parseDeploymentMetrics(deployment, pods, JSON.parse(metrics.metrics));
      console.log(`CPU: ${cpu}, Memory: ${memory}, CPU %: ${cpupcg}`);
        const label = new Date(epoch_ts).toLocaleTimeString();
        // @ts-ignore
        this.metricsgraph.chart.data.labels.push(label);
        // @ts-ignore
        this.metricsgraph.chart.data.datasets[0].data.push(cpupcg);
        // @ts-ignore
        this.metricsgraph.chart.data.datasets[1].data.push(mempcg);
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

  handleEvent(ev: any): void {
    const event = ev.name;
    const payload = ev.payload;
    if (event === this.beService.response_channel.app_command_result) {
      this.handleCommand(payload);
    }else if (event === this.beService.response_channel.app_metrics) {
      this.handleMetricsEvent(payload);
    }
  }

  private handleEnvironmentVariables(environmentVariables: any) {
    const data: any[] = [];
    Object.keys(environmentVariables).forEach((key) =>{
      data.push({
        key: key,
        value: environmentVariables[key]
      })
    });

    this.ngZone.run(() => {
      this.rowData = data;
    });
  }
}
