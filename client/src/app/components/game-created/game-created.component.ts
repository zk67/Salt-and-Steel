import { Game } from '@common/classes/game';
import { Output ,Input , Component, EventEmitter} from '@angular/core';
import { MapSize } from '@common/types/map.interface';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-game-created',
    standalone: true,
    templateUrl: './game-created.component.html',
    styleUrls: ['./game-created.component.scss'],
    imports: [CommonModule],
})

export class GameCreatedComponent{
    @Input() game: Game;

    @Output() toggle = new EventEmitter<Game>();
    @Output() editGame = new EventEmitter<string>();
    @Output() deleteGame = new EventEmitter<string>();

    get previewSrc() {
        if (this.game.imageUrl){
            return this.game.imageUrl;
        }
        return '';
    }

    get hasDescription(): boolean{
        return  !!this.game.description.trim();
    }

    get size(){
        return MapSize[this.game.size];
    }

    get mode(){
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
