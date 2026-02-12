import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Game } from '@common/types/game.interface';
import { MapSize } from '@common/types/map.interface';

@Component({
    selector: 'app-game-created',
    templateUrl: './game-created.component.html',
    styleUrls: ['./game-created.component.scss'],
    imports: [CommonModule],
})
export class GameCreatedComponent {
    @Input() game: Game;

    @Output() toggle = new EventEmitter<Game>();
    @Output() editGame = new EventEmitter<string>();
    @Output() deleteGame = new EventEmitter<string>();

    get previewSrc(): string {
        return this.game.imageUrl || '';
    }

    get hasDescription(): boolean {
        return !!this.game.description.trim();
    }

    get size(): string {
        return MapSize[this.game.size];
    }

    get mode(): string {
        return this.game.gameMode;
    }

    onToggle(): void {
        this.toggle.emit(this.game);
    }

    onEdit(): void {
        if (this.game._id) this.editGame.emit(this.game._id);
    }

    onDelete(): void {
        if (this.game._id) this.deleteGame.emit(this.game._id);
    }
}
