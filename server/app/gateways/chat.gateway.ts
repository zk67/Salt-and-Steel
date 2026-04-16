import { ChatService } from '@app/gateways/services/chat.service';
import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class ChatGateway implements OnGatewayInit {
    @WebSocketServer() server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly chatService: ChatService,
    ) {}

    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
    }

    formatTime(): string {
        const date = new Date();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    @SubscribeMessage(GatewayEvents.SendMessage)
    handleMessage(socket: Socket, payload: { content: string }) {
        const roomId = getRoomIdFromSocket(socket);
        const content = payload?.content?.trim();

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const author = game?.players.find((p) => p.id === socket.id);

        if (author?.id && author?.name) {
            this.chatService.setPlayerName(author.id, author.name);
        }

        const message: ChatMessage = {
            author: this.chatService.getPlayerName(socket.id),
            content,
            time: this.formatTime(),
            roomId,
            playerId: socket.id,
        };

        this.server.to(roomId).emit(GatewayEvents.Message, message);
        this.logger.log(`Message from ${socket.id}: ${payload.content}`);
    }
}
