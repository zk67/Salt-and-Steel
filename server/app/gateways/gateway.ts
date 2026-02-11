import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PRIVATE_ROOM_ID } from './gateway.constants';
import { GatewayEvents } from './gateway.events';

@WebSocketGateway({ cors: true })
@Injectable()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    private readonly room = PRIVATE_ROOM_ID;

    constructor(private readonly logger: Logger) {}

    @SubscribeMessage(GatewayEvents.Refresh)
    refresh(socket: Socket) {
        socket.broadcast.emit(GatewayEvents.Update);
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Connexion par l'utilisateur avec id : ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Déconnexion par l'utilisateur avec id : ${socket.id}`);
    }
}
