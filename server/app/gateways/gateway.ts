import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    @SubscribeMessage(GatewayEvents.Refresh)
    refresh(socket: Socket): void {
        socket.broadcast.emit(GatewayEvents.Update);
    }

    handleConnection(socket: Socket): void {
        this.logger.log(`Connexion par l'utilisateur avec id : ${socket.id}`);
    }

    handleDisconnect(socket: Socket): void {
        this.logger.log(`Déconnexion par l'utilisateur avec id : ${socket.id}`);
    }
}
