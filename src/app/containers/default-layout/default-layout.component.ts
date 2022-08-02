import {Component} from '@angular/core';
import {navItems} from './_nav';
import {Menu, Modes} from "angular-sidebar-menu";
import {faBars, faPlus} from '@fortawesome/free-solid-svg-icons';

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

  public navItems = navItems;
  private Roles: Roles.EDITOR | Roles.ADMIN | string | number | undefined;
  mainNavigationOpened = true;
  currentSidebarMode = Modes.MINI;
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
      iconClasses: 'fa fa-rocket',
    },
    {
      id: 'operations',
      header: 'Operations View',
    },
    {
      id: 'operations_view',
      label: 'Operations View',
      iconClasses: 'fa fa-share',
      roles: [],
      children: [
        {
          id: 'nodes',
          label: 'Nodes',
          route: '/nodes',
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
          label: 'Config Maps',
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


  public perfectScrollbarConfig = {
    suppressScrollX: true,
  };
  faBars = faBars;
  faPlus = faPlus;

  constructor() {
    console.log(this.menu);
  }

  onSidebarModeChanged() {
    if (this.currentSidebarMode === Modes.EXPANDED) {
      this.currentSidebarMode = Modes.MINI;
    }else if (this.currentSidebarMode === Modes.MINI) {
      this.currentSidebarMode = Modes.EXPANDED;
    }
  }
}
