import { Injectable, signal } from '@angular/core';

const DEFAULT_NOTIFICATION_DURATION_MS = 3000;

@Injectable({
  providedIn: 'root',
})
export class PopupService {
  readonly show = signal(false);
  readonly message = signal('');
  readonly notificationShow = signal(false);
  readonly notificationMessage = signal('');

  private notificationTimeout: ReturnType<typeof setTimeout> | null = null;

  open(message: string) {
    this.message.set(message);
    this.show.set(true);
  }

  close() {
    this.show.set(false);
    this.message.set('');
  }

  openNotification(message: string, durationMs = DEFAULT_NOTIFICATION_DURATION_MS) {
    this.clearNotificationTimeout();
    this.notificationMessage.set(message);
    this.notificationShow.set(true);

    this.notificationTimeout = setTimeout(() => {
      this.closeNotification();
    }, durationMs);
  }

  closeNotification() {
    this.clearNotificationTimeout();
    this.notificationShow.set(false);
    this.notificationMessage.set('');
  }

  private clearNotificationTimeout() {
    if (!this.notificationTimeout) {
      return;
    }

    clearTimeout(this.notificationTimeout);
    this.notificationTimeout = null;
  }
}
