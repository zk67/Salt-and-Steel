import { Component, computed } from '@angular/core';
import { Button } from '@app/components/game/game-button/game-button.component';
import { PlayerInfoComponent } from '@app/components/game/player-info/player-info.component';
import { TimeService } from '@app/services/time.service';

@Component({
    selector: 'app-right-sidebar',
    templateUrl: './right-sidebar.component.html',
    styleUrl: './right-sidebar.component.scss',
    imports: [PlayerInfoComponent, Button],
})
export class RightSidebarComponent {
    currentTime = computed(() => this.timerService.time());

    constructor(private timerService: TimeService) {}

    onAction = () => {
        // TODO: faire l'action si dispo
    };

    onEndTurn = () => {
        // TODO: terminer le tour et passer au prochain joueur
    };

    onSurrender = () => {
        // TODO: ramener à la page principale et enlever le joueur de la partie
    };
}