import {Component, ElementRef, Input, NgZone, OnInit, SimpleChanges, ViewChild, ViewEncapsulation} from '@angular/core';
import {Terminal} from "xterm";
import { FitAddon } from 'xterm-addon-fit';
import {appWindow} from "@tauri-apps/api/window";
import * as _ from "lodash";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements OnInit {

  private term: Terminal | undefined;
  container: HTMLElement | undefined;
  lastCommand = '';
  channelPrefix = '';
  @Input() mode = 'single';
  @Input() name = '';
  @Input() bounds: { width: number; height: number; } | undefined;
  viewInitialized = false;
  @Input() isUnicast = true;
  @ViewChild('terminalwindow') terminalwindow: ElementRef | undefined;
  loglines: {
    source: string,
    log: string,
    color: string
  }[];

  constructor(private ngZone: NgZone, private el:ElementRef) {
    this.loglines = [];
  }

  ngOnChanges(changes: SimpleChanges): void {
  }

  appendContent(content: {source: string, log: string, color: string}): void {
    this.ngZone.run(() => {
      this.loglines.push(content);
      try {
        // @ts-ignore
        this.terminalwindow.nativeElement.scrollTop = this.terminalwindow.nativeElement.scrollHeight;
      } catch(err) { }
    });
  }

  ngOnInit(): void {
    // const fitAddon = new FitAddon();
    // this.term = new Terminal({
    //   // cursorBlink: true,
    // });
    // this.term.loadAddon(fitAddon);
    // this.term.open(this.el.nativeElement);
    // fitAddon.fit();
  }

  onkeypress(e: any) {
    e.preventDefault();
    if (e.key === 'Enter') {
      // this.appendContent("\n");
    }
  }

  clear() {
    this.loglines = [];
  }
}
