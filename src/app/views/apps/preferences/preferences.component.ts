import {Component, ElementRef, NgZone, ViewChild, ViewChildren} from '@angular/core';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";

@Component({
  selector: 'app-environment',
  templateUrl: './preferences.component.html',
  styleUrls: [],
})

export class PreferencesComponent {
  namespaceString = '';
  licenseString = '';
  constructor(private ngZone: NgZone, private beService: TauriAdapter){

  }

  onPreferenceSave() {
    this.beService.executeSyncCommand(this.beService.commands.save_preference,{
      key: '',
      value: ''
    }, () => {

    })
  }
}
