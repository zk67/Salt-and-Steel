import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SocketClientService } from '@app/services/socket-client.service';
import { Game } from '@common/types/game.interface';

interface JoinableGame {
    roomId: string;
    game: Game;
    playerCount: number;
}
@Component({
    selector: 'join-game-page',
    templateUrl: './join-game-page.component.html',
    styleUrls: ['./join-game-page.component.scss'],
    imports: [RouterLink],
})

export class JoinGameComponent implements OnInit, OnDestroy {
    joinableGames: JoinableGame[] = [];

    private readonly onJoinableGames = (games: JoinableGame[]) => {
        this.joinableGames = games;
    };

    constructor(private socketService: SocketClientService) {}

    ngOnInit(): void {
        if (!this.socketService.isSocketAlive()) {
            this.socketService.connect();
        }

        this.socketService.on<JoinableGame[]>('joinableGames', this.onJoinableGames);
        this.socketService.send('getJoinableGames');
    }

    ngOnDestroy(): void {
        this.socketService.off('joinableGames', this.onJoinableGames);
    }
}
