import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Game } from '@common/types/game.interface';

@Component({
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  @Input() game: Game;
  @Output() click = new EventEmitter<void>();

  handleClick() {
    this.click.emit();
  }

  get previewSrc() {
    if (this.game.imageUrl) {
      return this.game.imageUrl;
    }
    return '';
  }

  get hasDescription(): boolean {
    return !!this.game.description?.trim();
  }
}
