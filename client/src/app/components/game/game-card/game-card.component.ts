import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '@common/types/game.interface';

@Component({
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  @Input() game: Game;
  @Output() click = new EventEmitter<void>();

  constructor(private router: Router) {}
  handleClick() {
    const queryParams = {
      gameId: this.game._id,
    };
    this.router.navigate(['/character-form'], {
      queryParams,
      state: { from: 'create' }  // si ce fichier est aussi utiliser dans la page joindre un partie, alors il faut changer cette ligne
    });
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
