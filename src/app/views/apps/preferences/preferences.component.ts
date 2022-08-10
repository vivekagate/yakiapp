import {Component, ElementRef, NgZone, ViewChild, ViewChildren} from '@angular/core';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";

@Component({
  selector: 'app-environment',
  templateUrl: './preferences.component.html',
  styleUrls: [],
})

export class PreferencesComponent {
  be_ns = '';
  be_lic = '';
  namespaceString = '';
  licenseString = '';
  CUSTOM_NS_LIST = 'CUSTOM_NS_LIST';
  LICENSE_STRING_KEY = 'LICENSE_STRING_KEY';

  constructor(private ngZone: NgZone, private beService: TauriAdapter){

  }

  ngOnInit(): void {
    const args: any = {};
    args[this.LICENSE_STRING_KEY] = '';
    args[this.CUSTOM_NS_LIST] = '';

    this.beService.executeSyncCommand(this.beService.commands.get_preferences, args, (res) => {
      if (res) {
        try{
          const result = JSON.parse(res);
          if (result.data) {
            const data = JSON.parse(result.data);
            console.log(data);
            this.ngZone.run(() => {
              data.forEach((pref: any) => {
                if (pref.key === this.CUSTOM_NS_LIST) {
                  this.be_ns = this.namespaceString = pref.value;
                }else if (pref.key === this.LICENSE_STRING_KEY) {
                  this.be_lic = this.licenseString = pref.value;
                }
              });

            });
          }
        }catch(e) {

        }

      }
    })
  }

  savePreference(key: string, value: string) {
    this.beService.executeSyncCommand(this.beService.commands.save_preference,{
      key: key,
      value: value
    }, () => {

    })
  }

  onPreferenceSave() {
    if (this.be_ns !== this.namespaceString) {
      this.savePreference(this.CUSTOM_NS_LIST, this.namespaceString);
    }

    if (this.be_lic !== this.licenseString) {
      this.savePreference(this.LICENSE_STRING_KEY, this.licenseString);
    }

  }
}
