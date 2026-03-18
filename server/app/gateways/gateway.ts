import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CurrentGamesService } from '@app/current-games.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger ,private readonly currentGamesService: CurrentGamesService) {}

    broadcastUpdate(): void {
        this.server.emit(GatewayEvents.Update);
    }

    handleConnection(socket: Socket): void {
        this.logger.log(`Connexion par l'utilisateur avec id : ${socket.id}`);
    }

    handleDisconnect(socket: Socket): void {
        const updatedRooms = this.currentGamesService.clearSelectedAvatarByClientId(socket.id);
        for (const room of updatedRooms) {
            const avatars = this.currentGamesService.getUnavailableAvatars(room);
            this.server.to(room).emit('unavailableAvatars', avatars);
        }
        this.logger.log(`Déconnexion par l'utilisateur avec id : ${socket.id}`);
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(socket: Socket, roomId: string): void {
        if (!roomId) return;
        socket.join(roomId);
        this.logger.log(`${socket.id} joined room ${roomId}`);
    }

    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(socket: Socket, roomId: string): void {
        if (!roomId) return;
        socket.leave(roomId);
        this.logger.log(`${socket.id} left room ${roomId}`);
    }

    @SubscribeMessage('getPlayerId')
    getPlayerId(client: Socket, player: Player): void {
        player.id = client.id;
        client.emit('playerId', player);
    }
}
