import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Game } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';

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
        this.gameService.clearGameService();
        this.gameService.setSelectedJoinRoomId(roomId);
        this.router.navigate([APP_ROUTES.characterForm]);
    }

    ngOnInit(): void {
        if (!this.socketService.isSocketAlive()) {
            this.socketService.connect();
        }

        this.socketService.on<JoinableGame[]>(GatewayEvents.JoinableGames, this.onJoinableGames);
        this.socketService.send(GatewayEvents.GetJoinableGames);
    }

    ngOnDestroy(): void {
        this.socketService.off(GatewayEvents.JoinableGames, this.onJoinableGames);
    }
}
