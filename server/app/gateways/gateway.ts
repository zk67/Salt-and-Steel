import { GatewayEvents } from '@common/types/gateway.events';
import { Player } from '@common/types/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    broadcastUpdate(): void {
        this.server.emit(GatewayEvents.Update);
    }

    handleConnection(socket: Socket): void {
        this.logger.log(`Connexion par l'utilisateur avec id : ${socket.id}`);
    }

    handleDisconnect(socket: Socket): void {
        this.logger.log(`Déconnexion par l'utilisateur avec id : ${socket.id}`);
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(client: Socket, room: string): void {
        this.logger.log(`Client ${client.id} joining room: ${room}`);
        client.join(room);
    }

    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(client: Socket, room: string): void {
        this.logger.log(`Client ${client.id} leaving room: ${room}`);
        client.leave(room);
    }

    @SubscribeMessage('getPlayerId')
    getPlayerId(client: Socket, player: Player): void {
        player.id = client.id;
        client.emit('playerId', player);
    }
}
