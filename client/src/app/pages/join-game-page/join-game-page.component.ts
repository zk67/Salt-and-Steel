import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { Game } from '@common/interfaces/game.interface';

interface JoinableGame {
    roomId: string;
    game: Game;
    playerCount: number;
}
@Component({
    selector: 'app-join-game-page',
    templateUrl: './join-game-page.component.html',
    styleUrls: ['./join-game-page.component.scss'],
    imports: [RouterLink],
})

export class JoinGameComponent implements OnInit, OnDestroy {
    joinableGames = signal<JoinableGame[]>([]);

    private readonly onJoinableGames = (games: JoinableGame[]) => {
        this.joinableGames.set(games);
    };

    constructor(private socketService: SocketClientService, private gameService: GameService, private router: Router) {}

    selectGame(roomId: string): void {
        this.gameService.setSelectedJoinRoomId(roomId);
        this.router.navigate(['/character-form']);
    }

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
