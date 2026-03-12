import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SocketClientService } from '@app/services/socket-client.service';
import { Player } from '@common/types/player.interface';

@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [RouterLink],
})
export class WaitingPageComponent {
    players: Player[] = [];

    private onPlayersToGame = (p: Player[]) => {
        this.players = p;
    };

    constructor(
        private socketService: SocketClientService,
        private router: Router,
        private route: ActivatedRoute,
    ) {}

    startGame(): void {
        this.router.navigate(['/game']);
        this.socketService.send('startGame');
    }

    goHome(): void {
        const gameId = this.route.snapshot.queryParams.gameId;
        this.socketService.leaveRoom(gameId);
        this.router.navigate(['/home']);
    }

    ngOnInit(): void {
        this.socketService.on('playersToGame', this.onPlayersToGame);
        this.socketService.send('getPlayersToGame');
    }

    ngOnDestroy(): void {
        this.socketService.off('playersToGame', this.onPlayersToGame);
    }
}
