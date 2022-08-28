import {AfterViewInit, Component, ElementRef, NgZone, ViewChild, ViewEncapsulation} from '@angular/core';
import {TauriAdapter} from "../../../providers/data/tauri-adapter.service";
import {EventListener} from "../../../providers/types";
import {FitAddon} from "xterm-addon-fit";
import {ITerminalOptions, Terminal} from "xterm";

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements EventListener{
  content = '';
  @ViewChild('terminalholder')
  terminal: ElementRef | undefined;

  name = '';
  command = '';

  constructor(private ngZone: NgZone, private beService: TauriAdapter) {
  }

  ngOnInit(): void {
      this.name = this.beService.storage.metadata.metadata.name;
      // if (this.name) {
      // }
      this.beService.registerListener(this.beService.events.app_events_channel, this);
      this.beService.executeCommandInCurrentNs(this.beService.commands.open_shell, {
          pod: this.beService.storage.metadata.metadata.name
      });
      this.terminal?.nativeElement.focus();
      console.log('initing');
 }

  ngOnDestroy(): void {
      this.beService.executeCommandInCurrentNs(this.beService.commands.send_to_shell, {
          command: 'exit\n',
          pod: this.name
      });
      this.beService.unRegisterListener(this);
  }

  getName(): string {
    return "shell.component";
  }

  handleEvent(ev: any): void {
    const event = ev.event;
    const data = ev.payload.data;
    this.ngZone.run(() => {
        if (data === 'clear\r') {
            this.content = '';
        }else{
            this.content += data.replace(this.command, '');
        }
        this.command = '';
    });
  }

    keyDown($event: KeyboardEvent) {
      if (this.isKeyIgnore($event.key)) {
          if (this.isKeyPreventDefault($event.key) || !this.command) {
              $event.preventDefault();
          }
      }else{
          if ($event.key === 'Enter') {
              this.beService.executeCommandInCurrentNs(this.beService.commands.send_to_shell, {
                  command: this.command + '\n',
                  pod: this.name
              });
          } else if ($event.key === 'Backspace') {
              if (!this.command) {
                  $event.preventDefault();
              }else{
                  this.command = this.command.substring(0, this.command.length - 1);
              }
          } else {
              this.command += $event.key;
          }
      }
    }

    private isKeyIgnore(key: string) {
        return key === 'Alt' || key === 'Shift' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
    }


    private isKeyPreventDefault(key: string) {
        return key === 'ArrowUp' || key === 'ArrowDown';
    }
}
