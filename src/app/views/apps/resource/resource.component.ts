import {Component, NgZone} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Resource, ResourceData} from "./resource-data";

@Component({
  selector: 'app-resource',
  templateUrl: './resource.component.html',
  styleUrls: ['./resource.component.scss']
})
export class ResourceComponent {
  resource: Resource;

  constructor(private resourceData: ResourceData, private aRoute: ActivatedRoute) {
    this.resource = {
      columns: [],
      command: [],
      name: 'UNKNOWN'
    };
  }

  ngOnInit() {
    this.aRoute.data.subscribe(data => {
      console.log(data);
      this.initResource(data['resource']);
    })
  }

  private initResource(datum: string) {
    this.resource = this.resourceData.getResource(datum);
  }
}
