import {Component, NgZone, ViewChild} from '@angular/core';
import { FooterComponent } from '@coreui/angular';
import {faPaperPlane, faBug, faCreditCard} from "@fortawesome/free-solid-svg-icons";
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import * as _ from "lodash";
import {EventListener} from "../../../providers/types";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";


@Component({
  selector: 'app-default-footer',
  templateUrl: './default-footer.component.html',
  styleUrls: ['./default-footer.component.scss'],
})
export class DefaultFooterComponent extends FooterComponent implements EventListener{
  faEmail = faPaperPlane;
  faGithub = faBug;
  faCreditcard = faCreditCard;

  isValidLicense = false;
  @ViewChild("modal_eula")
  private content: HTMLElement | undefined;

  @ViewChild("modal_license")
  private licenseModal: HTMLElement | undefined;

  licenseString: any;
  license: {
    name: string;
    expiry: string;
  };

  constructor(private beService: TauriAdapter, private modalService: NgbModal, private ngZone: NgZone) {
    super();
    this.license = {
      name: '',
      expiry: ''
    }
    this.beService.registerListener(this.beService.events.app_events_channel, this);
  }

  ngOnDestroy(): void {
    this.beService.unRegisterListener(this);
  }

  getName(): string {
    return 'default-footer.component.ts';
  }

  handleEvent(ev: any): void {
    const evname = ev.name;
    const payload = ev.payload;

    if (evname === this.beService.events.app_events_channel) {
      if (payload.event === this.beService.events.valid_license_found) {
        this.isValidLicense = true;
      }else if (payload.event === this.beService.events.no_license_found) {
        this.isValidLicense = false;
      }else if (payload.event === this.beService.events.eula_not_accepted) {
        this.showEula();
      }
    }
  }

  private showEula() {
    this.modalService.open(this.content, {ariaLabelledBy: 'modal-basic-title'}).result.then((result) => {
      this.beService.executeSyncCommand(this.beService.commands.eula_accepted, {}, () => {
        console.log('EULA Accepted');
      });
    }, (reason) => {
      // this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  showLicenseAddModal() {
    this.modalService.open(this.licenseModal, {ariaLabelledBy: 'modal-basic-title'}).result.then((result) => {

    }, (reason) => {
      // this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  addLicense() {
    this.beService.executeSyncCommand(this.beService.commands.add_license, {
      license: this.licenseString
    }, (result) => {
      console.log(result);

      try{
        const profile = JSON.parse(JSON.parse(result).data);
        this.ngZone.run(() => {
          this.isValidLicense = true;
          this.license = {
            name: profile.name,
            expiry: new Date(profile.expiry).toDateString()
          };
        });
      }catch(e) {
        alert('License is invalid. Please contact nirops.contact@gmail.com to ensure the license is correct.');
      }
    });
  }
}
