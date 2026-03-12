import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-game-button',
    templateUrl: './game-button.component.html',
    styleUrl: './game-button.component.scss',
    imports: [CommonModule],
})
export class Button {
    @Input() label: string = '';
    @Input() onClick: (() => void) | undefined;
    @Input() disabled: boolean = false;
    @Input() variant: 'action' | 'end-turn' | 'surrender' = 'action';
    @Output() clicked = new EventEmitter<void>();
}