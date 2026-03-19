import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { PopupComponent } from '@app/components/popup/popup.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
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
    players: Player[] = [];
    showClosedMessage = false;
    showKickedMessage = false;

    currentPlayerName: string = '';
    currentPlayerId: string = '';

    private onPopState = () => {
        this.goHome();
        setTimeout(() => {
            this.router.navigate([APP_ROUTES.home]);
        }, TIME_BEFORE_NAVIGATING_HOME);
    };

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
        if (!this.isOrganizer || this.players.length < 2) {
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

        window.addEventListener('beforeunload', this.onBeforeUnload);
        window.addEventListener('unload', this.onBeforeUnload);
        window.addEventListener('pagehide', this.onBeforeUnload);
        window.addEventListener('popstate', this.onPopState);

        this.socketService.on(GatewayEvents.PlayersToGame, this.onPlayersToGame);
        this.socketService.on(GatewayEvents.Message, this.addMessage);
        this.socketService.on(GatewayEvents.GameClosed, this.onGameClosed);
        this.socketService.on(GatewayEvents.GameStartInfo, this.onGameStarted);
        this.socketService.on(GatewayEvents.Kicked, this.onKicked);
        this.socketService.send(GatewayEvents.GetPlayersToGame);

        this.gameService.clearChatMessages();
        this.messages = this.gameService.getChatMessages();
        const currentPlayer = this.gameService.clientPlayer();
        if (currentPlayer) {
            this.currentPlayerName = currentPlayer.name;
            this.currentPlayerId = currentPlayer.id;
        }
    }

    ngOnDestroy(): void {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        window.removeEventListener('unload', this.onBeforeUnload);
        window.removeEventListener('pagehide', this.onBeforeUnload);
        window.removeEventListener('popstate', this.onPopState);

        this.socketService.off(GatewayEvents.PlayersToGame, this.onPlayersToGame);
        this.socketService.off(GatewayEvents.Message, this.addMessage);
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


    private addMessage = (msg: ChatMessage) => {
        this.messages = [...this.messages, msg];
        this.gameService.setChatMessages(this.messages);
    };

    sendMessage(content: string): void {
        this.socketService.sendMessage(content);
    }
};

