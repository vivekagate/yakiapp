import {Component, ElementRef, NgZone, ViewChild, ViewChildren} from '@angular/core';
import * as _ from 'lodash';
import {invoke} from '@tauri-apps/api/tauri';
import {appWindow} from "@tauri-apps/api/window";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {
  DisplayGrid,
  GridsterConfig,
  GridsterItem,
  GridsterItemComponentInterface,
  GridType
} from "angular-gridster2";

@Component({
  selector: 'app-environment',
  templateUrl: './preferences.component.html',
  styleUrls: [],
})

export class PreferencesComponent {
  envvars = [];
  constructor(private ngZone: NgZone){

  }
}
