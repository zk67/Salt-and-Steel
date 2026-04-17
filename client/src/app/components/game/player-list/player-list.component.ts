import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GameService } from '@app/services/game/game.service';
import { GameMode } from '@common/enums/map.enums';
import { Player } from '@common/interfaces/player.interface';

@Component({
    selector: 'app-player-list',
    templateUrl: './player-list.component.html',
    styleUrl: './player-list.component.scss',
    imports: [CommonModule],
})
export class PlayerListComponent {
    constructor(private gameService: GameService) {}

    readonly players = this.gameService.players;

    isActive(player: Player): boolean {
        return this.gameService.activePlayer()?.id === player.id;
    }

    isRedTeam(player: Player): boolean {
        return player.isRedTeam ?? false;
    }

    isCTF(): boolean {
        return this.gameService.gameMode === GameMode.CTF;
    }
}
