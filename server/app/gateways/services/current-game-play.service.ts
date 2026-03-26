import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { BattleWonPayload, DebugMovePayload, GameInfoPayload, MovePlayerPayload, ToggleDebugPayload } from '@common/interfaces/game.interface';
import { Position } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';

@Injectable()
export class CurrentGamePlayService {
    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
    ) {}

    bindTurnEmitter(): void {
        this.currentGamesService.setEmitCallback((roomId, payload) => {
            this.broadcastService.emitNewTurn(roomId, payload);
        });
    }

    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Player ${payload.playerId} attempting to move ${payload.direction}`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        if (this.currentGamesService.movePlayer(room, payload.playerId, payload.direction)) {
            this.broadcastService.emitPlayerMoved(room, payload);
            this.logger.log(`Player ${payload.playerId} moved ${payload.direction}`);
            return;
        }

        this.logger.warn(`Failed to move player ${payload.playerId} in direction ${payload.direction}`);
    }

    startGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Starting game for room: ${room}`);
        const game = this.currentGamesService.startGame(room);

        if (!game) {
            this.logger.warn(`Unable to start game for room: ${room}`);
            return;
        }

        this.logger.log(`Game started for room: ${room} with players: ${game.players.map((player) => player.name).join(', ')}`);
        const gameInfoPayload: GameInfoPayload = {
            players: game.players,
            game: game._game,
        };

        this.broadcastService.emitGameStartInfo(room, gameInfoPayload);
    }

    endTurnEarly(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.validateEndTurnEarly(room, client.id);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) {
            return;
        }

        const isCurrentPlayer = client.id === game.turnOrder[game.currentTurnIndex];
        const isHostDebug = client.id === game.idHost && game.debugMode;

        if (!isCurrentPlayer && !isHostDebug) {
            return;
        }

        this.currentGamesService.nextPlayerTurn(room);
    }

    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move to (${payload.targetPos.x}, ${payload.targetPos.y})`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        if (this.currentGamesService.debugMove(room, payload.playerId, payload.targetPos)) {
            this.broadcastService.emitDebugMove(room, payload);
            return;
        }

        this.logger.warn(`Failed to move player ${payload.playerId} to (${payload.targetPos.x}, ${payload.targetPos.y})`);
    }

    handleBattleWon(client: Socket, payload: BattleWonPayload): void {
        if (!(this.validatePlayer(client, payload.winnerId) || this.validatePlayer(client, payload.loserId))) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const [updatedPayload, battleValid, isGameOver] = this.currentGamesService.battleWon(room, payload);

        if (!battleValid) {
            return;
        }
        const { combatRound, ...publicPayload } = updatedPayload;
        this.broadcastService.emitBattleWon(room, publicPayload);
        if (combatRound) {
            this.broadcastService.emitCombatRoundDetails([updatedPayload.winnerId, updatedPayload.loserId], combatRound);
        }
        this.logger.log(`Player ${payload.winnerId} has won the battle against ${payload.loserId}`);

        if (isGameOver) {
            this.broadcastService.emitGameOver(room, payload.winnerId);
        }
    }

    handleToggleDebugMode(client: Socket, payload: ToggleDebugPayload): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);

        if (!game) {
            this.logger.warn(`Game not found for room ID: ${room}`);
            return;
        }

        payload.hostId = game.idHost;
        payload.debugMode = !game.debugMode;
        if (client.id === game.idHost) {
            this.currentGamesService.toggleDebugMode(game, payload);
            this.broadcastService.emitToggleDebugMode(room, payload);
        }

        this.logger.log(`Toggled debug mode to ${payload.debugMode} for room: ${room}`);
    }

    handleActionOnTile(client: Socket, position: Position): void {
        const room = getRoomIdFromSocket(client);

        if (this.currentGamesService.doActionAtTile(room, client.id, position)) {
            this.broadcastService.emitActionOnTile(room, position, client.id);
            this.logger.log(`Player ${client.id} performed an action on tile at (${position.x}, ${position.y}) in room ${room}`);
            return;
        }

        this.logger.warn(`Failed to perform action on tile for player ${client.id} at (${position.x}, ${position.y}) in room ${room}`);
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

        const player = game.players.find((currentPlayer) => currentPlayer.id === socket.id);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${socket.id}`);
            return false;
        }

        return true;
    }
}
