import { Game, MovePlayerPayload, GameInfoPayload, DebugMovePayload, BattleWonPayload } from '@common/types/game.interface';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CurrentGamesService } from '@app/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
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

        if (!this.validatePlayer(client, payload.playerId)) {
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
    createGame(client: Socket, game: Game): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.createGame(game, room);
        this.logger.log(`Created game for room: ${room} with game name: ${game.name}`);
    }

    @SubscribeMessage('endTurnEarly')
    endTurnEarly(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.validateEndTurnEarly(room, client.id);
        this.currentGamesService.nextPlayerTurn(room);
    }


    @SubscribeMessage('debugMove')
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move to (${payload.x}, ${payload.y})`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);

        if (this.currentGamesService.debugMove(room, payload.playerId, payload.x, payload.y)) {
            this.server.emit('handleClickDebug', payload);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} to (${payload.x}, ${payload.y})`);
        }
    }

    @SubscribeMessage('battleWon')
    handleBattleWon(client: Socket, payload: BattleWonPayload): void {
        if (!this.validatePlayer(client, payload.winnerId) || !this.validatePlayer(client, payload.loserId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const [updatedPayload, battleValid, isGameOver] = this.currentGamesService.battleWon(room, payload);

        if(battleValid) {
            this.server.emit('handleBattleWon', updatedPayload);
            this.logger.log(`Player ${payload.winnerId} has won the battle against ${payload.loserId}`);
            
            if (isGameOver) {
                this.server.to(room).emit('gameOver', { winnerId: payload.winnerId });
            }
        }
    }

    @SubscribeMessage('surrender')
    handleSurrender(client: Socket): void {
        const room = getRoomIdFromSocket(client);

        if(this.currentGamesService.removePlayerFromGame(room, client.id)){
            this.logger.log(`Player ${client.id} has surrendered in room: ${room}`);
            this.server.to(room).emit('removePlayer', { playerId: client.id });
        }
    }
}