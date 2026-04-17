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
        return new Date().toLocaleTimeString('en-CA', {
            timeZone: 'America/Toronto',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    }

    @SubscribeMessage(GatewayEvents.SendMessage)
    handleMessage(socket: Socket, payload: { content: string }) {
        const roomId = getRoomIdFromSocket(socket);
        const content = payload?.content?.trim();

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const author = game?.players.find((player) => player.id === socket.id);

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
