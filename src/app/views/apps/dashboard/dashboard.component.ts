import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, NgZone, OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { getStyle } from '@coreui/utils/src';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import * as _ from "lodash";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {faEllipsisV} from "@fortawesome/free-solid-svg-icons";
import {Router} from "@angular/router";
import {EventListener} from "../../../providers/types";

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Default
})
export class DashboardComponent implements OnInit, AfterContentInit, EventListener, OnDestroy {

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private ndata: TauriAdapter,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.apps = [];
    this.namespaces = [];
    this.selectedNs = {
      name: 'default'
    };
  }

  faEllipsisV = faEllipsisV;


  error: string | undefined;

  namespaces: {
    name: string
  }[];
  selectedNs: {
    name: string
  };

  apps: {
    name: string,
    color: string,
    replicas: number,
    ready_replicas: number,
    unavailable_replicas: number,
    available_replicas: number,
    creation_ts: number,
    restart_ts: number,
    reason: string,
    ns: string,
    status: string
  }[];
  data: any[] = [];
  options: any[] = [];
  labels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    'January',
    'February',
    'March',
    'April'
  ];
  datasets = [
    [{
      label: 'My First dataset',
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,.55)',
      pointBackgroundColor: getStyle('--cui-primary'),
      pointHoverBorderColor: getStyle('--cui-primary'),
      data: [65, 59, 84, 84, 51, 55, 40]
    }], [{
      label: 'My Second dataset',
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,.55)',
      pointBackgroundColor: getStyle('--cui-info'),
      pointHoverBorderColor: getStyle('--cui-info'),
      data: [1, 18, 9, 17, 34, 22, 11]
    }], [{
      label: 'My Third dataset',
      backgroundColor: 'rgba(255,255,255,.2)',
      borderColor: 'rgba(255,255,255,.55)',
      pointBackgroundColor: getStyle('--cui-warning'),
      pointHoverBorderColor: getStyle('--cui-warning'),
      data: [78, 81, 80, 45, 34, 12, 40],
      fill: true
    }], [{
      label: 'My Fourth dataset',
      backgroundColor: 'rgba(255,255,255,.2)',
      borderColor: 'rgba(255,255,255,.55)',
      data: [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82],
      barPercentage: 0.7
    }]
  ];
  optionsDefault = {
    plugins: {
      legend: {
        display: false
      }
    },
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          display: false
        }
      },
      y: {
        min: 30,
        max: 89,
        display: false,
        grid: {
          display: false
        },
        ticks: {
          display: false
        }
      }
    },
    elements: {
      line: {
        borderWidth: 1,
        tension: 0.4
      },
      point: {
        radius: 4,
        hitRadius: 10,
        hoverRadius: 4
      }
    }
  };


  ngOnInit(): void {
    this.ndata.registerListener(this.ndata.response_channel["app_command_result"], this);
    this.getAllNamespaces();
    this.getApplications(this.selectedNs.name);
    this.setData();
  }

  getName(): string {
    return 'dashboard.component.ts';
  }

  ngOnDestroy(): void {
    this.ndata.unRegisterListener(this);
  }

  getApplications(namespace: string) {
    this.ndata.executeCommand(this.ndata.commands.get_deployments, {
      ns: namespace
    })
  };

  getAllNamespaces() {
    this.ndata.executeCommand(this.ndata.commands.get_all_ns, {});
  }

  ngAfterContentInit(): void {
    this.changeDetectorRef.detectChanges();

  }

  setData() {
    for (let idx = 0; idx < 4; idx++) {
      this.data[idx] = {
        labels: idx < 3 ? this.labels.slice(0, 7) : this.labels,
        datasets: this.datasets[idx]
      };
    }
    this.setOptions();
  }

  setOptions() {
    for (let idx = 0; idx < 4; idx++) {
      const options = JSON.parse(JSON.stringify(this.optionsDefault));
      switch (idx) {
        case 0: {
          this.options.push(options);
          break;
        }
        case 1: {
          options.scales.y.min = -9;
          options.scales.y.max = 39;
          this.options.push(options);
          break;
        }
        case 2: {
          options.scales.x = { display: false };
          options.scales.y = { display: false };
          options.elements.line.borderWidth = 2;
          options.elements.point.radius = 0;
          this.options.push(options);
          break;
        }
        case 3: {
          options.scales.x.grid = { display: false, drawTicks: false };
          options.scales.x.grid = { display: false, drawTicks: false, drawBorder: false };
          options.scales.y.min = undefined;
          options.scales.y.max = undefined;
          options.elements = {};
          this.options.push(options);
          break;
        }
      }
    }
  }

  openDebug(name: string) {
    this.ndata.storage = {
      appname: name,
      ns: this.selectedNs.name
    }
    this.router.navigateByUrl('/debug');
  }

  handleEvent(ev: any): void {
    const evname = ev.name;
    const payload = ev.payload;
    if (payload) {
      try {
        let results = JSON.parse(_.get(payload, 'data'));
        let cmd = _.get(payload, 'command');
        if (cmd === this.ndata.commands.get_all_ns) {
          this.ngZone.run(() => {
            this.namespaces = results;
          });
        } else if (cmd === this.ndata.commands.get_deployments) {
          results.forEach((res: any) => {
            if ((res.available_replicas === 0) && (res.replicas > 0)) {
              res.status = 'down';
              res.reason = '--';
              res.color = 'danger';
            }else if (res.available_replicas === res.replicas) {
              res.status = 'up';
              res.color = 'success';
            }else{
              res.status = 'down';
              res.reason = '--';
              res.color = 'danger';
            }
          })
          this.ngZone.run(() => {
            this.apps = results;
          });
        }
      } catch (e) {
        console.error("Failed to parse payload");
      }
    } else {
      console.error("Invalid format");
    }
  }
}

@Component({
  selector: 'app-chart-sample',
  template: '<c-chart type="line" [data]="data" [options]="options" width="300" #chart></c-chart>'
})
export class ChartSample implements AfterViewInit {

  constructor() {}

  @ViewChild('chart') chartComponent!: ChartjsComponent;

  colors = {
    label: 'My dataset',
    backgroundColor: 'rgba(77,189,116,.2)',
    borderColor: '#4dbd74',
    pointHoverBackgroundColor: '#fff'
  };

  labels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  data = {
    labels: this.labels,
    datasets: [{
      data: [65, 59, 84, 84, 51, 55, 40],
      ...this.colors,
      fill: { value: 65 }
    }]
  };

  options = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    elements: {
      line: {
        tension: 0.4
      }
    }
  };

  ngAfterViewInit(): void {
    setTimeout(() => {
      const data = () => {
        return {
          ...this.data,
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          datasets: [{
            ...this.data.datasets[0],
            data: [42, 88, 42, 66, 77],
            fill: { value: 55 }
          }, { ...this.data.datasets[0], borderColor: '#ffbd47', data: [88, 42, 66, 77, 42] }]
        };
      };
      const newLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
      const newData = [42, 88, 42, 66, 77];
      let { datasets, labels } = { ...this.data };
      // @ts-ignore
      const before = this.chartComponent?.chart?.data.datasets.length;
      console.log('before', before);
      // console.log('datasets, labels', datasets, labels)
      // @ts-ignore
      // this.data = data()
      this.data = {
        ...this.data,
        datasets: [{ ...this.data.datasets[0], data: newData }, {
          ...this.data.datasets[0],
          borderColor: '#ffbd47',
          data: [88, 42, 66, 77, 42]
        }],
        labels: newLabels
      };
      // console.log('datasets, labels', { datasets, labels } = {...this.data})
      // @ts-ignore
      setTimeout(() => {
        const after = this.chartComponent?.chart?.data.datasets.length;
        console.log('after', after);
      });
    }, 5000);
  }
}
