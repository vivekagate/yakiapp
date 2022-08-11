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
  be_kfile = '';
  be_proxy = '';

  namespaceString = '';
  licenseString = '';
  kubeconfigFile = '';
  proxy_url = '';

  CUSTOM_NS_LIST = 'CUSTOM_NS_LIST';
  LICENSE_STRING_KEY = 'LICENSE_STRING_KEY';
  PKEY_KUBECONFIG_FILE_LOCATION = 'PKEY_KUBECONFIG_FILE_LOCATION'
  PKEY_PROXY_URL = 'PKEY_PROXY_URL';

  constructor(private ngZone: NgZone, private beService: TauriAdapter){

  }

  ngOnInit(): void {
    const args: any = {};
    args[this.LICENSE_STRING_KEY] = '';
    args[this.CUSTOM_NS_LIST] = '';
    args[this.PKEY_KUBECONFIG_FILE_LOCATION] = '';
    args[this.PKEY_PROXY_URL] = '';

    this.beService.executeSyncCommand(this.beService.commands.get_preferences, args, (res) => {
      if (res) {
        try{
          const result = JSON.parse(res);
          if (result.data) {
            const data = JSON.parse(result.data);
            this.ngZone.run(() => {
              data.forEach((pref: any) => {
                if (pref.key === this.CUSTOM_NS_LIST) {
                  this.be_ns = this.namespaceString = pref.value;
                }else if (pref.key === this.LICENSE_STRING_KEY) {
                  this.be_lic = this.licenseString = pref.value;
                }else if (pref.key === this.PKEY_KUBECONFIG_FILE_LOCATION) {
                  this.be_kfile = this.kubeconfigFile = pref.value;
                }else if (pref.key === this.PKEY_PROXY_URL) {
                  this.be_proxy = this.proxy_url = pref.value;
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

    if (this.be_kfile !== this.kubeconfigFile) {
      this.savePreference(this.PKEY_KUBECONFIG_FILE_LOCATION, this.kubeconfigFile);
    }

  }
}
