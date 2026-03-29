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
        private currentGamesService: CurrentGamesService,
    ) {}

    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
    }

    formatTime(): string {
        const date = new Date();
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        const s = date.getSeconds().toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    @SubscribeMessage(GatewayEvents.SendMessage)
    handleMessage(socket: Socket, payload: { content: string }) {
        const roomId = getRoomIdFromSocket(socket);
        const author = this.currentGamesService.getGameByRoomId(roomId).players.find((p) => p.id === socket.id);

        const message: ChatMessage = {
            author: author.name,
            content: payload.content,
            time: this.formatTime(),
            roomId,
            playerId: author.id,
        };

        this.server.to(roomId).emit(GatewayEvents.Message, message);
        this.logger.log(`Message from ${socket.id}: ${payload.content}`);
    }
}
