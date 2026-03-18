import { Component, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '@app/components/game/game-button/game-button.component';
import { PlayerInfoComponent } from '@app/components/game/player-info/player-info.component';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { TimeService } from '@app/services/game/time.service';
import { GatewayEvents } from '@common/types/gateway.events';

@Component({
    selector: 'app-right-sidebar',
    templateUrl: './right-sidebar.component.html',
    styleUrl: './right-sidebar.component.scss',
    imports: [PlayerInfoComponent, Button],
})
export class RightSidebarComponent {
    currentTime = computed(() => this.timerService.time());
    isYourTurn = computed(() => this.gameService.activePlayer()?.id === this.gameService.clientPlayer()?.id && !this.gameService.isWaitTurn());
    actionPointsLeft = computed(() => (this.gameService.clientPlayer()?.actionsLeft ?? 0) > 0);

    constructor(private timerService: TimeService, private gameService: GameService,
        private socketService: SocketClientService, private router: Router) {}

    onAction = () => {
        if (this.isYourTurn() && this.actionPointsLeft()) {
            this.gameService.changeActionMode();
        }
    };

    onEndTurn = () => {
        if (this.isYourTurn()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
        }
    };

    onSurrender = () => {
        this.socketService.send(GatewayEvents.Surrender);
        this.gameService.clearGameService();
        this.router.navigate(['/home']);
    };
}
