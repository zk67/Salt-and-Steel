import { Injectable, signal } from '@angular/core';
import { DEFAULT_NOTIFICATION_DURATION_MS } from '@common/types/menu-page.constants';

export interface ChoicePopupConfig {
  title?: string;
  message?: string;
  firstOptionLabel?: string;
  secondOptionLabel?: string;
  context?: string;
  data?: unknown;
  onFirstOption?: () => void;
  onSecondOption?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupService {
  readonly show = signal(false);
  readonly message = signal('');
  readonly notificationShow = signal(false);
  readonly notificationMessage = signal('');
  readonly choiceShow = signal(false);
  readonly choiceTitle = signal('');
  readonly choiceMessage = signal('');
  readonly choiceFirstOptionLabel = signal('Confirm');
  readonly choiceSecondOptionLabel = signal('Cancel');
  readonly choiceContext = signal<string | null>(null);
  readonly choiceData = signal<unknown>(null);

  private onChoiceFirstOption: (() => void) | null = null;
  private onChoiceSecondOption: (() => void) | null = null;

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

  openChoice(config: ChoicePopupConfig) {
    this.choiceTitle.set(config.title ?? 'Choix');
    this.choiceMessage.set(config.message ?? 'Veuillez choisir une option.');
    this.choiceFirstOptionLabel.set(config.firstOptionLabel ?? 'Confirmer');
    this.choiceSecondOptionLabel.set(config.secondOptionLabel ?? 'Annuler');
    this.choiceContext.set(config.context ?? null);
    this.choiceData.set(config.data ?? null);
    this.onChoiceFirstOption = config.onFirstOption ?? null;
    this.onChoiceSecondOption = config.onSecondOption ?? null;
    this.choiceShow.set(true);
  }

  selectChoiceFirstOption() {
    const callback = this.onChoiceFirstOption;
    this.closeChoice();
    callback?.();
  }

  selectChoiceSecondOption() {
    const callback = this.onChoiceSecondOption;
    this.closeChoice();
    callback?.();
  }

  closeChoice() {
    this.choiceShow.set(false);
    this.choiceTitle.set('');
    this.choiceMessage.set('');
    this.choiceFirstOptionLabel.set('Confirm');
    this.choiceSecondOptionLabel.set('Cancel');
    this.choiceContext.set(null);
    this.choiceData.set(null);
    this.onChoiceFirstOption = null;
    this.onChoiceSecondOption = null;
  }

  private clearNotificationTimeout() {
    if (!this.notificationTimeout) {
      return;
    }

    clearTimeout(this.notificationTimeout);
    this.notificationTimeout = null;
  }

  isPopupOpen(): boolean {
    return this.show() || this.choiceShow();
  }
}
