import { Component, computed, HostListener, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { PopupComponent } from '@app/components/popup/popup.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { GameMode } from '@common/enums/map.enums';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { TIME_BEFORE_NAVIGATE_HOME, TIME_BEFORE_NAVIGATING_HOME, WAITING_PAGE_REFRESH_FLAG, MAX_PLAYERS } from '@common/types/menu-page.constants';


@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [ChatComponent, PopupComponent],
})
export class WaitingPageComponent implements OnInit, OnDestroy {

    messages: ChatMessage[] = [];
    playersSignal = signal<Player[]>([]);
    maxPlayers = signal<number>(this.gameService.getSelectedHostGame?.()?.maxPlayers ?? MAX_PLAYERS);
    showClosedMessage = false;
    showKickedMessage = false;

    currentPlayerName: string = '';
    currentPlayerId: string = '';

    gameMode = GameMode;
    currentGameMode = signal<GameMode | null>(null);
    emptySlots = computed(() => Array.from({ length: Math.max(this.maxPlayers() - this.playersSignal().length, 0) }));
    canAddVirtualPlayer = computed(() => this.isOrganizer && this.playersSignal().length < this.maxPlayers());


    isStartingGameValid = computed(() => {
        if (!this.isOrganizer || !this.currentGameMode()) return false;
        if (this.playersSignal().length > this.maxPlayers()) return false;

        if (this.currentGameMode() === GameMode.CTF) {
            return this.playersSignal().length >= 2 && this.playersSignal().length % 2 === 0;
        } else {
            return this.playersSignal().length >= 2;
        }
    });

    @HostListener('window:popstate')
    onPopState(): void {
        this.goHome();
        setTimeout(() => {
            this.router.navigate([APP_ROUTES.home]);
        }, TIME_BEFORE_NAVIGATING_HOME);
    }

    private onPlayersToGame = (player: Player[]) => {
        this.ngZone.run(() => {
            this.playersSignal.set(player);
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

    @HostListener('window:beforeunload')
    @HostListener('window:unload')
    @HostListener('window:pagehide')
    onBeforeUnload(): void {
        sessionStorage.setItem(WAITING_PAGE_REFRESH_FLAG, '1');
        this.goHome();
    }

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

        this.socketService.on<{ gameMode: GameMode; maxPlayers: number }>(GatewayEvents.GetGameModes, (payload) => {
            this.currentGameMode.set(payload.gameMode);
            if (payload.maxPlayers > 0) {
                this.maxPlayers.set(payload.maxPlayers);
            }
        });

        this.socketService.on(GatewayEvents.PlayersToGame, this.onPlayersToGame);
        this.socketService.on(GatewayEvents.GameClosed, this.onGameClosed);
        this.socketService.on(GatewayEvents.GameStartInfo, this.onGameStarted);
        this.socketService.on(GatewayEvents.Kicked, this.onKicked);
        this.socketService.send(GatewayEvents.GetPlayersToGame);
    }

    ngOnDestroy(): void {
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

    addVirtualPlayer(profile: string): void {
        if (!this.isOrganizer) return;
        this.socketService.send(GatewayEvents.AddVirtualPlayer, { profile });
    }

    removeVirtualPlayer(playerId: string): void {
        if (!this.isOrganizer) return;
        this.socketService.send(GatewayEvents.RemoveVirtualPlayer, { playerId });
    }
};
