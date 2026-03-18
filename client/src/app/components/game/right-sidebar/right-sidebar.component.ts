import { Component, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '@app/components/game/game-button/game-button.component';
import { PlayerInfoComponent } from '@app/components/game/player-info/player-info.component';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { TimeService } from '@app/services/time.service';

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
            this.socketService.send('endTurnEarly');
        }
    };

    onSurrender = () => {
        this.socketService.send('surrender');
        this.router.navigate(['/home']);
    };
}