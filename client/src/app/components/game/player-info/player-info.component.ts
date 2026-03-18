import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { GameService } from '@app/services/game.service';
import { DiceTarget } from '@common/enums/player.enums';
import { Player } from '@common/interfaces/player.interface';


@Component({
    selector: 'app-player-info',
    templateUrl: './player-info.component.html',
    styleUrl: './player-info.component.scss',
    imports: [CommonModule],

})
export class PlayerInfoComponent {
    readonly diceTarget = DiceTarget;

    player = computed(() => this.gameService.clientPlayer() as Player);

    constructor(private gameService: GameService) {}
}