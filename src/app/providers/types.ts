export interface EventListener {
  handleEvent(ev: any): void;
  getName(): string;
}
