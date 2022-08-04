import {Component, HostListener} from '@angular/core';
import {Menu, Modes} from "angular-sidebar-menu";
import {faBars, faPlus} from '@fortawesome/free-solid-svg-icons';
import {NgEventBus} from "ng-event-bus";
import {TauriAdapter} from "../../providers/data/tauri-adapter.service";
import {MetaData} from "ng-event-bus/lib/meta-data";

export enum Roles {
  ADMIN,
  EDITOR
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls:['./default-layout.component.scss']
})
export class DefaultLayoutComponent {

  private Roles: Roles.EDITOR | Roles.ADMIN | string | number | undefined;
  mainNavigationOpened = true;
  currentSidebarMode = Modes.EXPANDED;
  currentSearch?: string;
  inputSearchFocus = false;


  public menu: Menu = [
    {
      id: 'developer_view',
      header: 'Developer View',
    },
    {
      id: 'apps',
      label: 'Applications',
      route: '/applications',
      iconClasses: 'fas fa-browser',
    },
    {
      id: 'operations',
      header: 'Operations View',
    },
    {
      id: 'operations_view',
      label: 'Operations View',
      iconClasses: 'fa fa-eye',
      roles: [],
      children: [
        {
          id: 'nodes',
          label: 'Nodes',
          route: '/nodes',
          iconClasses: 'fa fa-server'
        },
        {
          id: 'deployments',
          label: 'Deployments',
          route: '/deployments',
        },
        {
          id: 'services',
          label: 'Services',
          route: '/services',
        },
        {
          id: 'pods',
          label: 'Pods',
          route: '/pods',
        },
        {
          id: 'config_maps',
          label: 'Config Maps & Secrets',
          route: '/configmaps',
        },
        {
          id: 'cron_jobs',
          label: 'Cron Jobs',
          route: '/cronjobs',
        },
        {
          id: 'daemon_sets',
          label: 'Daemon Sets',
          route: '/daemonsets',
        },
        {
          id: 'hpa',
          label: 'HPAs & Replica Sets',
          route: '/hpas',
        },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      route: '/preferences',
      iconClasses: 'fa fa-gear',
    },
  ];


  faBars = faBars;
  faPlus = faPlus;

  constructor(private eventBus: NgEventBus, private beService: TauriAdapter) {
    console.log('Menu is this' + this.menu);
    console.log(this.menu);
  }

  onSidebarModeChanged() {
    if (this.currentSidebarMode === Modes.EXPANDED) {
      this.currentSidebarMode = Modes.MINI;
    }else if (this.currentSidebarMode === Modes.MINI) {
      this.currentSidebarMode = Modes.EXPANDED;
    }
  }


  @HostListener('document:keydown.escape')
  handleEscape() {
    this.eventBus.cast(this.beService.ngeventbus.app_events, this.beService.ngevent.escape_hit);
  }
}
