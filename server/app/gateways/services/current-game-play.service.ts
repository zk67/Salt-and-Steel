import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { MapObjectType } from '@common/enums/map.enums';
import {
    ActionOnTilePayload,
    ActiveCombatPayload,
    DebugMovePayload,
    GameInfoPayload,
    GameOverPayload,
    MovePlayerPayload,
    PassFlagPayload,
    SubmitCombatPosturePayload,
    ToggleDebugPayload,
    UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { equalPositions } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';
import { CurrentGameCombatService } from './current-game-combat.service';

@Injectable()
export class CurrentGamePlayService {
    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
        private readonly combatService: CurrentGameCombatService,
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
            totalTurns: game.totalTurns ?? 0,
        };
        this.broadcastService.emitGameStartInfo(room, gameInfoPayload);
    }

    endTurnEarly(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.validateEndTurnEarly(room, client.id);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game || game.activeCombat) {
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

    handleActionOnTile(client: Socket, payload: ActionOnTilePayload): void {
        const room = getRoomIdFromSocket(client);

        if (this.currentGamesService.doActionAtTile(room, payload)) {
            this.broadcastService.emitActionOnTile(room, payload);
            this.logger.log(`Player ${payload.playerId} performed an action on tile at
                (${payload.position.x}, ${payload.position.y}) in room ${room}`);
            return;
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

        const player = game.players.find((currentPlayer) => currentPlayer.id === socket.id);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${socket.id}`);
            return false;
        }

        return true;
    }

    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        if (!this.validatePlayer(client, client.id)) {
            return;
        }

        this.combatService.handleStartCombat(client, payload);
    }

    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        if (!this.validatePlayer(client, client.id)) {
            return;
        }

        this.combatService.handleSubmitCombatPosture(client, payload);
    }

    handlePassFlag(client: Socket, payload: PassFlagPayload): boolean {
        const game = this.currentGamesService.getGameByRoomId(getRoomIdFromSocket(client));
        if (!game) return false;

        const initiator = game.players.find(player => player.id === payload.initiatorId);
        const target = game.players.find(player => player.id === payload.targetId);

        if (!initiator || !target) return false;

        let receiver: Player;

        if (payload.isPass) {
            initiator.hasFlag = false;
            target.hasFlag = true;
            receiver = target;

            this.logger.log(`Flag given: ${initiator.name} -> ${target.name}`);
        } else {
            target.hasFlag = false;
            initiator.hasFlag = true;
            receiver = initiator;

            this.logger.log(`Flag requested: ${target.name} -> ${initiator.name}`);
        }

        const spawnPoint = game.spawnPoints?.get(receiver.id);

        if (spawnPoint && equalPositions(receiver.position, spawnPoint) && receiver.hasFlag) {
            const gameOverPayload: GameOverPayload = { winnerId: receiver.id, gameDurationSeconds: 0 };
            this.currentGamesService.gameOver(getRoomIdFromSocket(client), gameOverPayload);
        }

        return true;
    }

    handleUpdateFlag(client: Socket, payload: UpdateFlagPayload): boolean {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) {
            this.logger.warn(`Game not found for room ID: ${room}`);
            return false;
        }

        const player = game.players.find(findPlayer => findPlayer.id === payload.playerId);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${client.id}`);
            return false;
        }

        player.hasFlag = payload.flagStatus;
        player.position = payload.position;
        game._game.tiles[payload.position.y][payload.position.x].mapObject = payload.flagStatus ? MapObjectType.None : MapObjectType.Flag;

        return true;
    }

    getGameByRoomId(roomId: string) {
        return this.currentGamesService.getGameByRoomId(roomId);
    }
}
