import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PopupService {
  readonly show = signal(false);
  readonly message = signal('');

  open(message: string) {
    this.message.set(message);
    this.show.set(true);
  }

  close() {
    this.show.set(false);
    this.message.set('');
  }
}
