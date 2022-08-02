import { Injectable } from '@angular/core';

@Injectable()
export class Cache {

  private storage: Map<string, object>;

  public constructor() {
    this.storage = new Map();
  }

  public get(key: string) {
    return this.storage.get(key);
  }

  public set(key: string, value: object) {
    console.log('Adding to cache: ' + key);
    return this.storage.set(key, value);
  }

}
