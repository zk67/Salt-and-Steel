import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameCombatService } from '@app/gateways/services/current-game-combat.service';
import { JoinableGameSummary, PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesCombatService, SubmitCombatPostureResult } from '@app/service/current-games-combat-resolution.service';
import { GameLifecycleService } from '@app/service/game-lifecycle.service';
import { RoomPlayerStateService } from '@app/service/room-player-state.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { VirtualPlayerService } from '@app/service/virtual-player/virtual-player.service';
import { Timer } from '@app/utils/game-timer';
import { giveShrineBuff } from '@app/utils/game-utils';
import {
    ActionOnTilePayload,
    CombatPosture,
    Game,
    GameOverPayload,
    NewTurnPayload,
    ToggleDebugPayload,
    UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player, Profile } from '@common/interfaces/player.interface';
import { VirtualPlayerTurnResult } from '@common/interfaces/virtual-player.interface';
import { DIRECTION_STRING } from '@common/types/game.record';
import { getVPTurnDelayMs } from '@common/types/player.constants';
import { addPositions, arePositionAdjacent, equalPositions, isTileDoor, isValidTile, Position, TILE_MOVEMENT_COST } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private stopWatch: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;

    private roomPlayerStateService = new RoomPlayerStateService();
    private gameLifecycleService = new GameLifecycleService();
    private turnFlowService: TurnFlowService;
    private virtualPlayerService = new VirtualPlayerService();
    private combatService: CurrentGamesCombatService;
    private combatGatewayService: CurrentGameCombatService | undefined;

    setCombatGatewayService(service: CurrentGameCombatService): void {
        this.combatGatewayService = service;
    }

    constructor(private readonly broadcastService?: CurrentGameBroadcastService) {
        this.turnFlowService = new TurnFlowService((roomId, playerId) => {
            this.broadcastService?.emitShrineBuffOff(roomId, playerId);
        });

        this.combatService = new CurrentGamesCombatService(
            this.broadcastService,
            this.timer,
        );
    }

    // Setup
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

    // Player
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

    // VP
    addVirtualPlayer(roomId: string, profile: Profile): Player | null {
        const game = this.getGameByRoomId(roomId);
        if (!game) return null;
        if (game.players.length >= game._game.maxPlayers) return null;

        const id = `vp-${crypto.randomUUID()}`;
        const player = this.virtualPlayerService.createVirtualPlayer(id, profile, game.players);

        Logger.log(`VP created: id=${player.id}, isVirtual=${player.isVirtual}, profile=${player.virtualProfile}`);

        game.players.push(player);
        return player;
    }

    removeVirtualPlayer(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const index = game.players.findIndex(p => p.id === playerId && p.isVirtual);
        if (index === -1) return false;

        game.players.splice(index, 1);
        return true;
    }

    executeVirtualPlayerTurn(roomId: string, vpId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        if (game.activeCombat) return;

        const vp = game.players.find(p => p.id === vpId && p.isVirtual);
        if (!vp) return;

        const result = this.virtualPlayerService.decideTurn(vp, game);

        if (result.moved) {
            this.handleVirtualPlayerFlagPickup(roomId, vp);
            this.broadcastService?.emitDebugMove(roomId, {
                playerId: vp.id,
                targetPos: vp.position,
            });
        }

        if (this.handleVirtualPlayerCombat(roomId, result)) return;

        if (result.actionOnTile) {
            if (this.doActionAtTile(roomId, result.actionOnTile)) {
                this.broadcastService?.emitActionOnTile(roomId, result.actionOnTile);
            }
        }

        if (!result.moved && !result.startedCombat && !result.actionOnTile) {
            this.nextPlayerTurn(roomId);
            return;
        }

        this.scheduleNextVirtualAction(roomId, vp, game);
    }

    submitVirtualPlayerPostures(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game?.activeCombat) return;

        const { attackerId, defenderId } = game.activeCombat;

        for (const playerId of [attackerId, defenderId]) {
            if (!game.activeCombat) return;

            const player = game.players.find(p => p.id === playerId);
            if (!player?.isVirtual) continue;

            const posture =
                player.virtualProfile === Profile.Aggressive
                    ? CombatPosture.Offensive
                    : CombatPosture.Defensive;

            this.combatService.submitCombatPosture(game, playerId, posture);
        }
    }

    private handleVirtualPlayerCombat(roomId: string, result: VirtualPlayerTurnResult): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;
        if (game.activeCombat) return true;

        if (!result.startedCombat || !result.attackerId || !result.defenderId) return false;

        this.combatGatewayService?.handleVirtualPlayerStartCombat(
            roomId,
            result.attackerId,
            result.defenderId,
        );

        return true;
    }

    private scheduleNextVirtualAction(roomId: string, vp: Player, game: PlayableGame): void {
        const currentPlayerId = game.turnOrder?.[game.currentTurnIndex];
        if (currentPlayerId !== vp.id) return;

        if (vp.movementPoints > 0) {
            const delay = getVPTurnDelayMs();
            setTimeout(() => this.executeVirtualPlayerTurn(roomId, vp.id), delay);
        } else {
            this.nextPlayerTurn(roomId);
        }
    }

    private handleVirtualPlayerFlagPickup(roomId: string, vp: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || game._game.gameMode !== GameMode.CTF) return;

        const tile = game._game.tiles[vp.position.y][vp.position.x];

        if (tile.mapObject === MapObjectType.Flag) {
            tile.mapObject = MapObjectType.None;
            vp.hasFlag = true;

            const payload: UpdateFlagPayload = {
                playerId: vp.id,
                flagStatus: true,
                position: vp.position,
            };

            this.broadcastService?.emitUpdateFlag(roomId, payload);
        }

        if (
            tile.mapObject === MapObjectType.SpawnPoint &&
            equalPositions(game.spawnPoints?.get(vp.id), vp.position) &&
            vp.hasFlag
        ) {
            vp.hasFlag = false;
            this.broadcastService?.emitGameOver(roomId, vp.id);
        }
    }

    // Game start
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

    // Turns
    changeTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        this.turnFlowService.changeTurn(game, this.timer, this.emitTurnUpdate.bind(this), this.executeVirtualPlayerTurn.bind(this));
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

    // Movement & Action
    movePlayer(roomId: string, playerId: string, direction: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        const directionVector = DIRECTION_STRING[direction];
        if (!directionVector) return false;

        const newPosition = addPositions(player.position, directionVector);
        if (!isValidTile(game._game.tiles, newPosition)) return false;

        const movementCost =
            TILE_MOVEMENT_COST[game._game.tiles[newPosition.y][newPosition.x].tileType];

        if (player.movementPoints < movementCost) return false;

        player.movementPoints -= movementCost;
        player.position = newPosition;

        const tile = game._game.tiles[newPosition.y][newPosition.x];

        if (game._game.gameMode === GameMode.CTF) {
            if (tile.mapObject === MapObjectType.Flag) {
                tile.mapObject = MapObjectType.None;

                const payload: UpdateFlagPayload = {
                    playerId: player.id,
                    flagStatus: true,
                    position: newPosition,
                };

                this.handleUpdateFlag(roomId, payload);
                this.broadcastService.emitUpdateFlag(roomId, payload);

                Logger.log(`${player.name} picked up the flag in room ${roomId}.`);
            }

            if (
                tile.mapObject === MapObjectType.SpawnPoint &&
                equalPositions(game.spawnPoints?.get(player.id), newPosition) &&
                player.hasFlag
            ) {
                this.broadcastService.emitGameOver(roomId, player.id);
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
            tile.tileType =
                tile.tileType === TileType.CloseDoor
                    ? TileType.OpenDoor
                    : TileType.CloseDoor;
        }

        player.actionsLeft--;
        return true;
    }

    // Combat
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