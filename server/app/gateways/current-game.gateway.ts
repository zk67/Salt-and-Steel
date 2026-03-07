import { CurrentGamesService } from '@app/current-games.service';
import { GamesService } from '@app/database/game/services/game.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { GameInfoPayload, MovePlayerPayload } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly gamesService: GamesService,
    ) {}

    afterInit(): void {
        this.currentGamesService.setEmitCallback((roomId, payload) => {
            this.server.to(roomId).emit('newTurn', payload);
        });
    }

    @SubscribeMessage('movePlayer')
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Player ${payload.playerId} attempting to move ${payload.direction}`);
        const isPlayerValid = this.validatePlayer(client, payload.playerId);

        if (!isPlayerValid) {
            this.logger.warn(`Player ID is not valid for socket ID: ${client.id}`);
            return;
        }

        if (this.currentGamesService.movePlayer(room, payload.playerId, payload.direction)) {
            this.server.to(room).emit('playerMoved', payload);
            this.logger.log(`Player ${payload.playerId} moved ${payload.direction}`);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} in direction ${payload.direction}`);
        }
    }

    private validatePlayer(socket: Socket, playerId: string): boolean {
        const room = getRoomIdFromSocket(socket);

        if (playerId !== socket.id) {
            this.logger.warn(`Player ID ${playerId} does not match socket ID ${socket.id}`);
            return false;
        }

        const game = this.currentGamesService.getGameByRoomId(room);

        if (!game) {
            this.logger.warn(`Game not found for room ID: ${room}`);
            return false;
        }

        const player = game.players.find(p => p.id === socket.id);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${socket.id}`);
            return false;
        }

        return true;
    }

    @SubscribeMessage('startGame')
    startGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Starting game for room: ${room}`);
        const game = this.currentGamesService.startGame(room);
        this.logger.log(`Game started for room: ${room} with players: ${game?.players.map(p => p.name).join(', ')}`);

        const gameInfoPayload: GameInfoPayload = {
            players: game.players,
            game: game._game,
        };

        this.server.to(room).emit('gameStartInfo', gameInfoPayload);
    }

    @SubscribeMessage('createGame')
    async createGame(client: Socket, data: { id: string }): Promise<boolean> {
        const room = getRoomIdFromSocket(client);
        const gameId = data.id;
        const game = await this.gamesService.getOneGame(gameId);
        if (!game) {
            this.logger.warn(`Game not found in DB for id: ${gameId}`);
            return false;
        }
        this.currentGamesService.createGame(game, room);
        this.logger.log(`Created game for room: ${room} with game name: ${game.name}`);
        return true;
    }

    @SubscribeMessage('addPlayerToGame')
    addPlayerToGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.addPlayerToGame(room, player);
        this.logger.log(`Added player ${player.name} to game in room: ${room}`);
    }

    @SubscribeMessage('getPlayersToGame')
    getPlayersToGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const players = this.currentGamesService.getPlayersToGame(room);
        this.server.to(room).emit('playersToGame', players); // a tester pour savoir si c'est mieux ça ou client.emit (vérifier si ça envoie trop de requêtes (genre 1 pas personne alors qu'on a besoin d'un en tout))
    }
}
