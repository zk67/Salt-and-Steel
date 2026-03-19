import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Game } from '@common/interfaces/game.interface';

@Component({
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  private _game: Game;
  @Output() click = new EventEmitter<void>();

  handleClick() {
    this.click.emit();
  }

  @Input()
  set game(game: Game) {
    this._game = game;
  }

  get game(): Game {
    return this._game;
  }

  get previewSrc() {
    if (this._game.imageUrl) {
      return this._game.imageUrl;
    }
    return '';
  }

  get hasDescription(): boolean {
    return !!this._game.description?.trim();
  }
}
