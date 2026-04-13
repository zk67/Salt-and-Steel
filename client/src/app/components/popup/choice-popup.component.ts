import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-choice-popup',
    template: `
        @if (show) {
            <div class="popup-overlay" role="dialog" aria-modal="true">
                <div class="popup">
                    <button type="button" class="close-button" aria-label="Fermer" (click)="onClose()">×</button>

                    @if (title) {
                        <h2>{{ title }}</h2>
                    }

                    @if (message) {
                        <p>{{ message }}</p>
                    }

                    <div class="actions">
                        <button type="button" class="option secondary" (click)="onSecondOption()">
                            {{ secondOptionLabel }}
                        </button>
                        <button type="button" class="option primary" (click)="onFirstOption()">
                            {{ firstOptionLabel }}
                        </button>
                    </div>
                </div>
            </div>
        }
    `,
    styleUrls: ['./choice-popup.component.scss'],
})

export class ChoicePopupComponent {
    @Input() show = false;
    @Input() title = '';
    @Input() message = '';
    @Input() firstOptionLabel = 'Confirm';
    @Input() secondOptionLabel = 'Cancel';

    @Output() firstOptionSelected = new EventEmitter<void>();
    @Output() secondOptionSelected = new EventEmitter<void>();
    @Output() closeRequested = new EventEmitter<void>();

    onFirstOption(): void {
        this.firstOptionSelected.emit();
    }

    onSecondOption(): void {
        this.secondOptionSelected.emit();
    }

    onClose(): void {
        this.closeRequested.emit();
    }
}
