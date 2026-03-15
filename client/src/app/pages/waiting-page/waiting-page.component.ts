import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { Player } from '@common/types/player.interface';

const TIME_BEFORE_NAVIGATE_HOME = 5000;
const WAITING_PAGE_REFRESH_FLAG = 'waitingPageRefresh';

@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [],
})
export class WaitingPageComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    showClosedMessage = false;
    showKickedMessage = false;

    private onPlayersToGame = (p: Player[]) => {
        this.ngZone.run(() => {
            this.players = p;
        });
    };

    private onGameClosed = () => {
        this.ngZone.run(() => {
            const roomId = this.gameService.getSelectedJoinRoomId();
            if (roomId) {
                this.socketService.leaveRoom(roomId);
            }
            this.gameService.clearSelectedJoinRoomId();
            this.showClosedMessage = true;
            setTimeout(() => {
                this.router.navigate(['/home']);
            }, TIME_BEFORE_NAVIGATE_HOME);
        });
    };

    private onKicked = () => {
        this.ngZone.run(() => {
            const roomId = this.gameService.getSelectedJoinRoomId();
            if (roomId) {
                this.socketService.leaveRoom(roomId);
            }
            this.gameService.clearSelectedJoinRoomId();
            this.showKickedMessage = true;
            setTimeout(() => {
                this.router.navigate(['/home']);
            }, TIME_BEFORE_NAVIGATE_HOME);
        });
    };

    private onGameStarted = () => {
        this.ngZone.run(() => {
            this.router.navigate(['/game']);
        });
    };

    constructor(
        private socketService: SocketClientService,
        private ngZone: NgZone,
        private router: Router,
        private gameService: GameService,
    ) {}

    get isOrganizer(): boolean {
        return this.gameService.clientPlayer()?.isOrganizer ?? false;
    }

    get clientPlayerId(): string | null {
        return this.gameService.clientPlayer()?.id ?? null;
    }

    startGame(): void {
        if (!this.isOrganizer || this.players.length < 2) {
            return;
        }

        this.router.navigate(['/game']);
        this.socketService.send('startGame');
    }

    private onBeforeUnload = (): void => {
        sessionStorage.setItem(WAITING_PAGE_REFRESH_FLAG, '1');
        this.goHome(true);
    };

    goHome(skipNavigate = false): void {
        const roomId = this.gameService.getSelectedJoinRoomId();
        this.socketService.send('surrender');
        if (roomId) {
            this.socketService.leaveRoom(roomId);
        }
        this.gameService.clearSelectedJoinRoomId();
        if (!skipNavigate) {
            this.router.navigate(['/home']);
        }
    }

    ngOnInit(): void {
        const wasRefreshing = sessionStorage.getItem(WAITING_PAGE_REFRESH_FLAG);
        if (wasRefreshing) {
            sessionStorage.removeItem(WAITING_PAGE_REFRESH_FLAG);
            this.router.navigate(['/home']);
            return;
        }

        window.addEventListener('beforeunload', this.onBeforeUnload);
        window.addEventListener('unload', this.onBeforeUnload);
        window.addEventListener('pagehide', this.onBeforeUnload);

        this.socketService.on('playersToGame', this.onPlayersToGame);
        this.socketService.on('gameClosed', this.onGameClosed);
        this.socketService.on('gameStartInfo', this.onGameStarted);
        this.socketService.on('kicked', this.onKicked);
        this.socketService.send('getPlayersToGame');
    }

    ngOnDestroy(): void {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        window.removeEventListener('unload', this.onBeforeUnload);
        window.removeEventListener('pagehide', this.onBeforeUnload);

        this.socketService.off('playersToGame', this.onPlayersToGame);
        this.socketService.off('gameClosed', this.onGameClosed);
        this.socketService.off('gameStartInfo', this.onGameStarted);
        this.socketService.off('kicked', this.onKicked);
    }

    kickPlayer(playerId: string): void {
        if (!this.isOrganizer) {
            return;
        }

        this.socketService.send('kickPlayer', { playerId });
    }
}
