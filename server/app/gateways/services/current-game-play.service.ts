import { CurrentGamesService, SubmitCombatPostureResult } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import {
    ActiveCombatPayload,
    DebugMovePayload,
    GameInfoPayload, MovePlayerPayload,
    SubmitCombatPosturePayload,
    ToggleDebugPayload,
} from '@common/interfaces/game.interface';
import { Position } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';

const TIME_ROUND = 10;
@Injectable()
export class CurrentGamePlayService {
    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
    ) {}

    private combatRoundTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        if (!this.validatePlayer(client, client.id)) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const combatStarted = this.currentGamesService.startCombat(room, client.id, payload.defenderId);

        if (!combatStarted) {
            return;
        }
        this.scheduleCombatRoundTimeout(room);
        this.broadcastService.emitCombatStarted(
            [client.id, payload.defenderId],
            {
                attackerId: client.id,
                defenderId: payload.defenderId,
                roundTimeSeconds: TIME_ROUND,
            },
        );
    }

    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        if (!this.validatePlayer(client, client.id)) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const result = this.currentGamesService.submitCombatPosture(room, client.id, payload.posture);

        if (!result) {
            return;
        }

        if (result.roundResolved) {
            this.clearCombatRoundTimer(room);
        }

        this.processCombatResult(room, result);
    }

    private clearCombatRoundTimer(roomId: string): void {
        const timer = this.combatRoundTimers.get(roomId);
        if (timer) {
            clearTimeout(timer);
            this.combatRoundTimers.delete(roomId);
        }
    }

    private scheduleCombatRoundTimeout(roomId: string): void {
        this.clearCombatRoundTimer(roomId);

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const activeCombat = game?.activeCombat;
        if (!activeCombat) {
            return;
        }

        const timeout = setTimeout(() => {
            const result = this.currentGamesService.resolveCombatRoundOnTimeout(roomId);
            if (!result) {
                return;
            }

            this.processCombatResult(roomId, result);
        }, activeCombat.roundTimeSeconds * 1000);

        this.combatRoundTimers.set(roomId, timeout);
    }

    private processCombatResult(roomId: string, result: SubmitCombatPostureResult): void {
        const game = this.currentGamesService.getGameByRoomId(roomId);

        if (result.roundResolved && result.combatRound) {
            this.broadcastService.emitCombatRoundDetails(
                [result.combatRound.attacker.playerId, result.combatRound.defender.playerId],
                result.combatRound,
            );
        }

        if (result.battlePayload) {
            this.clearCombatRoundTimer(roomId);

            const payloadWithoutRound = { ...result.battlePayload };
            delete payloadWithoutRound.combatRound;

            this.broadcastService.emitBattleWon(roomId, payloadWithoutRound);

            if (result.isGameOver) {
                this.broadcastService.emitGameOver(roomId, result.battlePayload.winnerId);
            }

            return;
        }

        if (result.roundResolved && game?.activeCombat) {
            this.broadcastService.emitCombatStarted(
                [game.activeCombat.attackerId, game.activeCombat.defenderId],
                {
                    attackerId: game.activeCombat.attackerId,
                    defenderId: game.activeCombat.defenderId,
                    roundTimeSeconds: game.activeCombat.roundTimeSeconds,
                },
            );

            this.scheduleCombatRoundTimeout(roomId);
        }
    }
}
