import { CurrentGamesService } from '@app/current-games.service';
import { MovePlayerPayload } from '@common/types/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Player } from '@common/types/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
    ) {}

    broadcastUpdate(): void {
        this.server.emit(GatewayEvents.Update);
    }

    handleConnection(socket: Socket): void {
        this.logger.log(`Connexion par l'utilisateur avec id : ${socket.id}`);
    }

    handleDisconnect(socket: Socket): void {
        this.logger.log(`Déconnexion par l'utilisateur avec id : ${socket.id}`);
    }

    @SubscribeMessage('movePlayer')
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move ${payload.direction}`);
        const isPlayerValid = this.validatePlayer(client, payload.playerId);

        if (!isPlayerValid) {
            this.logger.warn(`Player ID is not valid for socket ID: ${client.id}`);
            return;
        }

        if (this.currentGamesService.movePlayer(client.rooms[0], payload.playerId, payload.direction)) {
            this.server.emit('playerMoved', payload);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} in direction ${payload.direction}`);
        }
    }

    private validatePlayer(socket: Socket, playerId: string): boolean {
        if (playerId !== socket.id) {
            this.logger.warn(`Player ID ${playerId} does not match socket ID ${socket.id}`);
            return false;
        }

        const game = this.currentGamesService.getGameByRoomId(socket.rooms[0]);
        if (!game) {
            this.logger.warn(`Game not found for room ID: ${socket.rooms[0]}`);
            return false;
        }

        const player = game.players.find(p => p.id === socket.id);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${socket.id}`);
            return false;
        }

        return true;
    }

    @SubscribeMessage('getPlayerId')
    getPlayerId(client: Socket, player: Player): void {
        player.id = client.id;
        client.emit('playerId', player);
    }
}
