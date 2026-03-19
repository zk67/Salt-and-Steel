import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { LeftSidebarComponent } from '@app/components/game/left-sidebar/left-sidebar.component';
import { RightSidebarComponent } from '@app/components/game/right-sidebar/right-sidebar.component';
import { MapGameComponent } from '@app/components/map/map-game.component';
import { PopupComponent } from '@app/components/popup/popup.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { GatewayEvents } from '@common/types/gateway.events';


@Component({
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [MapGameComponent, LeftSidebarComponent, RightSidebarComponent, ChatComponent, PopupComponent],
})
export class GamePageComponent implements OnInit, OnDestroy {

    messages: ChatMessage[] = [];

    currentPlayerName: string = '';
    currentPlayerId: string = '';

    constructor(
        private socketService: SocketClientService,
        private gameService: GameService,
        public popupService: PopupService,
        private router: Router,
    ) {}

    ngOnInit(): void {
        const currentPlayer = this.gameService.clientPlayer();
        if (!currentPlayer) {
            this.router.navigate([APP_ROUTES.home]);
            return;
        }
        this.messages = this.gameService.getChatMessages();
        this.currentPlayerName = currentPlayer.name;
        this.currentPlayerId = currentPlayer.id;
        this.socketService.on(GatewayEvents.Message, this.addMessage);
    }

    ngOnDestroy(): void {
        this.socketService.off(GatewayEvents.Message, this.addMessage);
    }

    private addMessage = (msg: ChatMessage) => {
        this.messages = [...this.messages, msg];
        this.gameService.setChatMessages(this.messages);
    };

    sendMessage(content: string): void {
        this.socketService.sendMessage(content);
    }
}
