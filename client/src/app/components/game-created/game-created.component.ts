import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Game } from '@common/interfaces/game.interface';
import { MapSize } from '@common/interfaces/map.interface';

@Component({
    selector: 'app-game-created',
    templateUrl: './game-created.component.html',
    styleUrls: ['./game-created.component.scss'],
    imports: [CommonModule],
})
export class GameCreatedComponent {
    private _game: Game;
    @Output() toggle = new EventEmitter<Game>();
    @Output() editGame = new EventEmitter<string>();
    @Output() deleteGame = new EventEmitter<string>();

    @Input()
    set game(game: Game) {
        this._game = game;
    }

    get game(): Game {
        return this._game;
    }

    get previewSrc(): string {
        return this._game.imageUrl || '';
    }

    get hasDescription(): boolean {
        return !!this._game.description.trim();
    }

    get size(): string {
        return MapSize[this._game.size];
    }

    get mode(): string {
        return this._game.gameMode;
    }

    onToggle(): void {
        this.toggle.emit(this._game);
    }

    onEdit(): void {
        if (this._game._id) this.editGame.emit(this._game._id);
    }

    onDelete(): void {
        if (this._game._id) this.deleteGame.emit(this._game._id);
    }
}
