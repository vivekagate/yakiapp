import { Component } from '@angular/core';
import { FooterComponent } from '@coreui/angular';
import {faPaperPlane, faBug, faCreditCard} from "@fortawesome/free-solid-svg-icons";


@Component({
  selector: 'app-default-footer',
  templateUrl: './default-footer.component.html',
  styleUrls: ['./default-footer.component.scss'],
})
export class DefaultFooterComponent extends FooterComponent {
  faEmail = faPaperPlane;
  faGithub = faBug;
  faCreditcard = faCreditCard;
  constructor() {
    super();
  }

  onUpgrade() {

  }
}
