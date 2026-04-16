import { Component, computed, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { PopupComponent } from '@app/components/popup/popup.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { GameMode } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';

const TIME_BEFORE_NAVIGATE_HOME = 5000;
const TIME_BEFORE_NAVIGATING_HOME = 10;
const WAITING_PAGE_REFRESH_FLAG = 'waitingPageRefresh';

@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [ChatComponent, PopupComponent],
})
export class WaitingPageComponent implements OnInit, OnDestroy {

    messages: ChatMessage[] = [];
    playersSignal = signal<Player[]>([]);
    showClosedMessage = false;
    showKickedMessage = false;

    currentPlayerName: string = '';
    currentPlayerId: string = '';

    gameMode = GameMode;
    currentGameMode = signal<GameMode | null>(null);


    isStartingGameValid = computed(() => {
        if (!this.isOrganizer || !this.currentGameMode()) return false;

        if (this.currentGameMode() === GameMode.CTF) {
            return this.playersSignal().length % 2 === 0;
        } else {
            return this.playersSignal().length >= 2;
        }
    });

    private onPopState = () => {
        this.goHome();
        setTimeout(() => {
            this.router.navigate([APP_ROUTES.home]);
        }, TIME_BEFORE_NAVIGATING_HOME);
    };

    private onPlayersToGame = (p: Player[]) => {
        this.ngZone.run(() => {
            this.playersSignal.set(p);
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
                this.router.navigate([APP_ROUTES.home]);
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
                this.router.navigate([APP_ROUTES.home]);
            }, TIME_BEFORE_NAVIGATE_HOME);
        });
    };

    private onGameStarted = () => {
        this.ngZone.run(() => {
            this.router.navigate([APP_ROUTES.game]);
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
        if (!this.isStartingGameValid()) {
            return;
        }

        this.router.navigate([APP_ROUTES.game]);
        this.socketService.send(GatewayEvents.StartGame);
    }

    private onBeforeUnload = (): void => {
        sessionStorage.setItem(WAITING_PAGE_REFRESH_FLAG, '1');
        this.goHome();
    };

    goHome(): void {
        const roomId = this.gameService.getSelectedJoinRoomId();
        this.socketService.send(GatewayEvents.Surrender);
        if (roomId) {
            this.socketService.leaveRoom(roomId);
        }
        this.gameService.clearSelectedJoinRoomId();
        this.router.navigate([APP_ROUTES.home]);
    }

    ngOnInit(): void {
        const wasRefreshing = sessionStorage.getItem(WAITING_PAGE_REFRESH_FLAG);
        if (wasRefreshing) {
            sessionStorage.removeItem(WAITING_PAGE_REFRESH_FLAG);
            this.router.navigate([APP_ROUTES.home]);
            return;
        }

        const currentPlayer = this.gameService.clientPlayer();
        if (currentPlayer) {
            this.currentPlayerName = currentPlayer.name;
            this.currentPlayerId = currentPlayer.id;
        }

        window.addEventListener('beforeunload', this.onBeforeUnload);
        window.addEventListener('unload', this.onBeforeUnload);
        window.addEventListener('pagehide', this.onBeforeUnload);
        window.addEventListener('popstate', this.onPopState);

        this.socketService.on<{ gameMode: GameMode }>(GatewayEvents.GetGameModes, (payload) => {
            this.currentGameMode.set(payload.gameMode);
        });

        this.socketService.on(GatewayEvents.PlayersToGame, this.onPlayersToGame);
        this.socketService.on(GatewayEvents.GameClosed, this.onGameClosed);
        this.socketService.on(GatewayEvents.GameStartInfo, this.onGameStarted);
        this.socketService.on(GatewayEvents.Kicked, this.onKicked);
        this.socketService.send(GatewayEvents.GetPlayersToGame);
    }

    ngOnDestroy(): void {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        window.removeEventListener('unload', this.onBeforeUnload);
        window.removeEventListener('pagehide', this.onBeforeUnload);
        window.removeEventListener('popstate', this.onPopState);

        this.socketService.off(GatewayEvents.PlayersToGame, this.onPlayersToGame);
        this.socketService.off(GatewayEvents.GameClosed, this.onGameClosed);
        this.socketService.off(GatewayEvents.GameStartInfo, this.onGameStarted);
        this.socketService.off(GatewayEvents.Kicked, this.onKicked);
    }

    kickPlayer(playerId: string): void {
        if (!this.isOrganizer) {
            return;
        }
        this.socketService.send(GatewayEvents.KickPlayer, { playerId });
    }
};
