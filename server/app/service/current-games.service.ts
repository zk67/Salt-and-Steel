import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameCombatService } from '@app/gateways/services/current-game-combat.service';
import { JoinableGameSummary, PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesCombatService, SubmitCombatPostureResult } from '@app/service/current-games-combat-resolution.service';
import { GameLifecycleService } from '@app/service/game-lifecycle.service';
import { RoomPlayerStateService } from '@app/service/room-player-state.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { Timer } from '@app/utils/game-timer';
import { giveShrineBuff } from '@app/utils/game-utils';
import {
    ActionOnTilePayload, CombatPosture, Game, GameOverPayload, NewTurnPayload, ToggleDebugPayload, UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { DIRECTION_STRING } from '@common/types/game.record';
import { addPositions, arePositionAdjacent, equalPositions, isTileDoor, isValidTile, Position, TILE_MOVEMENT_COST } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';
import { VirtualPlayerFlowService } from './virtual-player/virtual-player-flow.service';
@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private stopWatch: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;
    private roomPlayerStateService = new RoomPlayerStateService();
    private gameLifecycleService = new GameLifecycleService();
    private turnFlowService: TurnFlowService;
    private virtualPlayerFlowService: VirtualPlayerFlowService;
    private combatService: CurrentGamesCombatService;
    private combatGatewayService: CurrentGameCombatService | undefined;

    setCombatGatewayService(service: CurrentGameCombatService): void {
        this.combatGatewayService = service;
    }

    getVirtualPlayerFlowService(): VirtualPlayerFlowService {
        return this.virtualPlayerFlowService;
    }
    
    constructor(private readonly broadcastService?: CurrentGameBroadcastService) {
        this.turnFlowService = new TurnFlowService((roomId, playerId) => {
            this.broadcastService?.emitShrineBuffOff(roomId, playerId);
        });
        this.virtualPlayerFlowService = new VirtualPlayerFlowService(
            (roomId) => this.getGameByRoomId(roomId),
            (roomId, payload) => this.doActionAtTile(roomId, payload),
            (roomId) => this.nextPlayerTurn(roomId),
            (roomId, attackerId, defenderId) => this.combatGatewayService?.startCombat(roomId, attackerId, defenderId),
            this.broadcastService,
        );
        
        this.combatService = new CurrentGamesCombatService(
            this.broadcastService,
            this.timer,
        );
    }

    setEmitCallback(callback: (roomId: string, payload: NewTurnPayload) => void): void {
        this.emitCallback = callback;
    }

    createGame(game: Game, roomId: string, gameId: string): void {
        game._id = gameId;
        this.games.push({ _game: game, roomId, players: [] });
    }
    getGameByRoomId(roomId: string): PlayableGame | undefined {
        return this.games.find((g) => g.roomId === roomId);
    }

    removeGame(roomId: string): boolean {
        const index = this.games.findIndex((g) => g.roomId === roomId);
        if (index === -1) return false;

        this.games.splice(index, 1);
        this.roomPlayerStateService.removeRoomState(roomId);
        return true;
    }
    
    addPlayerToGame(roomId: string, player: Player): void {
        const game = this.getGameByRoomId(roomId);

        Logger.log(`TurnOrder: ${JSON.stringify(game.turnOrder)}, index=${game.currentTurnIndex}`);

        if (game) {
            player.name = this.roomPlayerStateService.buildUniquePlayerName(roomId, player.name, game.players);
            game.players.push(player);

            Logger.log(`Player ${player.name} added to game in room ${roomId}. Total players: ${game.players.length}`);
        } else {
            Logger.log(`Game not found for room ${roomId}. Cannot add player ${player.name}.`);
        }
    }

    getPlayersToGame(roomId: string): Player[] {
        return this.getGameByRoomId(roomId)?.players ?? [];
    }

    removePlayerFromGame(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const playerIndex = game.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return false;

        if (game.turnOrder) {
            if (game.turnOrder[game.currentTurnIndex] === playerId) {
                this.nextPlayerTurn(roomId);
            }

            game.players.splice(playerIndex, 1);
            game.turnOrder = game.turnOrder.filter((id) => id !== playerId);
        } else {
            game.players.splice(playerIndex, 1);
        }
        return true;
    }

    startGame(roomId: string): PlayableGame {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        game.turnOrder = this.gameLifecycleService.initializeTurnOrder(game.players);
        this.allocateSpawnPoints(roomId);

        this.turnFlowService.startGameTurn(game, this.timer, this.emitTurnUpdate.bind(this));

        if (game._game.gameMode === GameMode.CTF) {
            this.gameLifecycleService.createTeams(game);
        }

        this.stopWatch.startTimer(roomId);
        return game;
    }

    gameOver(roomId: string, payload: GameOverPayload): void {
        this.timer.stopTimer(roomId);

        const gameDurationSeconds = this.stopWatch.getCurrentTime(roomId);
        const updatedPayload: GameOverPayload = { ...payload, gameDurationSeconds };

        this.stopWatch.stopTimer(roomId);
        this.removeGame(roomId);
        this.broadcastService?.emitGameOver(roomId, updatedPayload);
    }

    allocateSpawnPoints(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        this.gameLifecycleService.allocateSpawnPoints(game);
    }
    
    changeTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        this.turnFlowService.changeTurn(
            game,
            this.timer,
            this.emitTurnUpdate.bind(this),
            this.virtualPlayerFlowService.executeVirtualPlayerTurn.bind(this.virtualPlayerFlowService),
        );
    }

    nextPlayerTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        this.turnFlowService.nextPlayerTurn(game, this.timer, this.emitTurnUpdate.bind(this));
    }

    resumeTurnTimer(roomId: string, remainingSeconds: number): void {
        this.timer.startTurnTimer(roomId, remainingSeconds);
    }

    validateEndTurnEarly(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        if (!this.turnFlowService.isCurrentPlayerTurn(game, player)) {
            Logger.warn(`Ce n'est pas le tour du joueur (${player.name}) dans la salle ${roomId}.`);
            return false;
        }

        return true;
    }

    movePlayer(roomId: string, playerId: string, direction: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        const directionVector = DIRECTION_STRING[direction];
        if (!directionVector) return false;

        const newPosition = addPositions(player.position, directionVector);
        if (!isValidTile(game._game.tiles, newPosition)) return false;

        const movementCost = TILE_MOVEMENT_COST[game._game.tiles[newPosition.y][newPosition.x].tileType];

        if (player.movementPoints < movementCost) return false;

        player.movementPoints -= movementCost;
        player.position = newPosition;

        const tile = game._game.tiles[newPosition.y][newPosition.x];

        if (game._game.gameMode === GameMode.CTF) {
            if (tile.mapObject === MapObjectType.Flag) {
                tile.mapObject = MapObjectType.None;

                const payload: UpdateFlagPayload = { playerId: player.id, flagStatus: true, position: newPosition };

                this.handleUpdateFlag(roomId, payload);
                this.broadcastService.emitUpdateFlag(roomId, payload);

                Logger.log(`${player.name} picked up the flag in room ${roomId}.`);
            }

            if (
                tile.mapObject === MapObjectType.SpawnPoint &&
                equalPositions(game.spawnPoints?.get(player.id), newPosition) && player.hasFlag
            ) {
                this.gameOver(roomId, { winnerId: player.id, gameDurationSeconds: 0, endedByAbandon: false });
            }
        }

        return true;
    }

    isDebugMode(roomId: string): boolean {
        return this.getGameByRoomId(roomId)?.debugMode ?? false;
    }

    toggleDebugMode(game: PlayableGame, payload: ToggleDebugPayload): void {
        game.debugMode = payload.debugMode;
    }

    getJoinableGames(): JoinableGameSummary[] {
        return this.gameLifecycleService.getJoinableGames(this.games);
    }

    canJoinGame(roomId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        return this.gameLifecycleService.canJoinGame(game);
    }

    getUnavailableAvatars(roomId: string): string[] {
        const game = this.getGameByRoomId(roomId);
        return game ? this.roomPlayerStateService.getUnavailableAvatars(roomId, game.players) : [];
    }

    setSelectedAvatar(roomId: string, clientId: string, avatar: string): void {
        this.roomPlayerStateService.setSelectedAvatar(roomId, clientId, avatar);
    }

    clearSelectedAvatar(roomId: string, clientId: string): void {
        this.roomPlayerStateService.clearSelectedAvatar(roomId, clientId);
    }

    clearSelectedAvatarByClientId(clientId: string): string[] {
        return this.roomPlayerStateService.clearSelectedAvatarByClientId(clientId);
    }

    debugMove(roomId: string, playerId: string, position: Position): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        if (!this.turnFlowService.isCurrentPlayerTurnById(game, player.id)) return false;

        player.position = position;
        return true;
    }

    doActionAtTile(roomId: string, payload: ActionOnTilePayload): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return false;

        const player = game.players.find((p) => p.id === payload.playerId);
        if (!player) return false;

        if (!this.turnFlowService.isCurrentPlayerTurn(game, player)) {
            Logger.warn(`Ce n'est pas le tour du joueur (${player.name}) dans la room ${roomId}.`);
            return false;
        }

        if (!arePositionAdjacent(player.position, payload.position)) {
            Logger.warn(`Le joueur (${player.name}) ne peut pas interagir avec une tile non adjacente.`);
            return false;
        }

        if (player.actionsLeft <= 0) {
            Logger.warn(`Le joueur (${player.name}) n'a plus d'action restante.`);
            return false;
        }

        const tile = game._game.tiles[payload.position.y][payload.position.x];

        giveShrineBuff(game._game, player, payload);

        if (isTileDoor(tile)) {
            tile.tileType = tile.tileType === TileType.CloseDoor ? TileType.OpenDoor : TileType.CloseDoor;
        }

        player.actionsLeft--;
        return true;
    }

    startCombat(roomId: string, attackerId: string, defenderId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        return this.combatService.startCombat(game, attackerId, defenderId);
    }

    resolveCombatRoundOnTimeout(roomId: string): SubmitCombatPostureResult | null {
        const game = this.getGameByRoomId(roomId);
        if (!game) return null;

        return this.combatService.resolveCombatRoundOnTimeout(game);
    }

    submitCombatPosture(roomId: string, playerId: string, posture: CombatPosture): SubmitCombatPostureResult | null {
        const game = this.getGameByRoomId(roomId);
        if (!game) return null;

        return this.combatService.submitCombatPosture(game, playerId, posture);
    }

    handleUpdateFlag(roomId: string, payload: UpdateFlagPayload): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        return this.combatService.handleUpdateFlag(game, payload);
    }

    private emitTurnUpdate(roomId: string, payload: NewTurnPayload): void {
        this.emitCallback?.(roomId, payload);
    }
}