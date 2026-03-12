import { Component, computed } from '@angular/core';
import { PlayerListComponent } from '@app/components/game/player-list/player-list.component';
import { GameService } from '@app/services/game.service';
import { MapService } from '@app/services/map/map.service';

@Component({
    selector: 'app-left-sidebar',
    templateUrl: './left-sidebar.component.html',
    styleUrl: './left-sidebar.component.scss',
    imports: [PlayerListComponent],
})
export class LeftSidebarComponent {
    mapSize = computed(() => this.mapService.getSize());
    playerCount = computed(() => this.gameService.players().length);
    activePlayer = computed(() => this.gameService.activePlayer());
    isDebugMode = computed(() => this.gameService.isDebugMode());

    constructor(
        public mapService: MapService,
        public gameService: GameService,
    ) {}
}