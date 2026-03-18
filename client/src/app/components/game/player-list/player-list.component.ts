import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { GameService } from '@app/services/game.service';
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

    readonly sortedPlayers = computed(() =>
        [...this.players()].sort((a, b) => a.turnOrder - b.turnOrder),
    );

    isActive(player: Player): boolean {
        return this.gameService.activePlayer()?.id === player.id;
    }
}