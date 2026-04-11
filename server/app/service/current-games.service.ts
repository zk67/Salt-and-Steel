import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { JoinableGameSummary, PlayableGame } from '@app/interface/game.interface';
import { CombatContext, CombatResolutionService } from '@app/service/combat-resolution.service';
import { CombatRoundService } from '@app/service/combat-round.service';
import { GameLifecycleService } from '@app/service/game-lifecycle.service';
import { RoomPlayerStateService } from '@app/service/room-player-state.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { Timer } from '@app/utils/game-timer';
import {
    ActionOnTilePayload, BattleWonPayload, CombatPosture, CombatRoundDetails,
    Game, NewTurnPayload, ToggleDebugPayload, UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType, TileData } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { DIRECTION_STRING } from '@common/types/game.record';
import { addPositions, arePositionAdjacent, isShrine, isTileDoor, isValidTile, Position, TILE_MOVEMENT_COST } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';

export type SubmitCombatPostureResult = {
    roundResolved: boolean;
    combatRound?: CombatRoundDetails;
    battlePayload?: BattleWonPayload;
    isGameOver: boolean;
    shouldAdvanceTurn?: boolean;
};

const HALF_DOUBLE_NOTHING = 0.5;
@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;
    private roomPlayerStateService = new RoomPlayerStateService();
    private combatRoundService = new CombatRoundService();
    private gameLifecycleService = new GameLifecycleService();
    private turnFlowService: TurnFlowService;
    private combatResolutionService: CombatResolutionService;

    constructor(private readonly broadcastService?: CurrentGameBroadcastService) {
        this.turnFlowService = new TurnFlowService((roomId, playerId) => {
            this.broadcastService?.emitShrineBuffOff(roomId, playerId);
        });
        this.combatResolutionService = new CombatResolutionService(this.combatRoundService);
    }

    setEmitCallback(callback: (roomId: string, payload: NewTurnPayload) => void): void {
        this.emitCallback = callback;
    }

    createGame(game: Game, roomId: string, gameId: string): void {
        game._id = gameId;
        this.games.push({ _game: game, roomId, players: [] });
    }

    addPlayerToGame(roomId: string, player: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (game) {
            player.name = this.roomPlayerStateService.buildUniquePlayerName(roomId, player.name, game.players);
            game.players.push(player);
            Logger.log(`Player ${player.name} added to game in room ${roomId}. Total players: ${game.players.length}`);
        } else {
            Logger.log(`Game not found for room ${roomId}. Cannot add player ${player.name}.`);
        }
    }

    getPlayersToGame(roomId: string): Player[] {
        const game = this.getGameByRoomId(roomId);
        return game ? game.players : [];
    }

    getGameByRoomId(roomId: string): PlayableGame | undefined {
        return this.games.find((g) => g.roomId === roomId);
    }

    removeGame(roomId: string): boolean {
        const index = this.games.findIndex((g) => g.roomId === roomId);
        if (index === -1) {
            return false;
        }

        this.games.splice(index, 1);
        this.roomPlayerStateService.removeRoomState(roomId);
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
        if (player.movementPoints < movementCost) {
            return false;
        }

        player.movementPoints -= movementCost;
        player.position = newPosition;

        const tile = game._game.tiles[newPosition.y][newPosition.x];

        if (game._game.gameMode === GameMode.CTF && tile.mapObject === MapObjectType.Flag) {
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

        return true;
    }

    startGame(roomId: string): PlayableGame {
        const game = this.getGameByRoomId(roomId);
        if (!game) {
            Logger.warn(`Game not found for room ID: ${roomId}`);
            return;
        }

        game.turnOrder = this.gameLifecycleService.initializeTurnOrder(game.players);
        this.allocateSpawnPoints(roomId);
        this.turnFlowService.startGameTurn(game, this.timer, this.emitTurnUpdate.bind(this));
        if (game._game.gameMode === GameMode.CTF) {
            this.gameLifecycleService.createTeams(game);
        }

        return game;
    }

    allocateSpawnPoints(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        this.gameLifecycleService.allocateSpawnPoints(game);
    }

    changeTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        this.turnFlowService.changeTurn(game, this.timer, this.emitTurnUpdate.bind(this));
    }

    nextPlayerTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        this.turnFlowService.nextPlayerTurn(game, this.timer, this.emitTurnUpdate.bind(this));
    }

    resumeTurnTimer(roomId: string, remainingSeconds: number): void {
        this.timer.startTurnTimer(roomId, remainingSeconds);
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

    validateEndTurnEarly(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        if (!this.turnFlowService.isCurrentPlayerTurn(game, player)) {
            Logger.warn(`Ce n'est pas le tour du joueur (${player.name}) dans la room ${roomId}.`);
            return false;
        }

        return true;
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

    isDebugMode(roomId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        return game.debugMode;
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
        if (game) return this.roomPlayerStateService.getUnavailableAvatars(roomId, game.players);

        return [];
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
            Logger.warn(`Le joueur (${player.name}) ne peut pas interagir avec une tile non adjacente.
                Position du joueur: (${player.position.x},${player.position.y}), position ciblée: (${payload.position.x},${payload.position.y})`);
            return false;
        }

        if (player.actionsLeft <= 0) {
            Logger.warn(`Le joueur (${player.name}) n'a plus d'action restante.
                Actions restantes: ${player.actionsLeft}`);
            return false;
        }

        const tile = game._game.tiles[payload.position.y][payload.position.x];

        this.applyShrine(game, player, tile, payload);

        if (isTileDoor(tile)) {
            tile.tileType = tile.tileType === TileType.CloseDoor ? TileType.OpenDoor : TileType.CloseDoor;
        }

        player.actionsLeft--;
        return true;
    }

    private applyShrine(game: PlayableGame, player: Player, tile: TileData, payload: ActionOnTilePayload): void {
        if (!isShrine(tile.mapObject)) return;

        const shrine = game._game.shrine.find(s =>
            s.position.some(p => p.x === payload.position.x && p.y === payload.position.y),
        );

        if (!shrine) return;

        let buffMultiplier = 1;

        if (payload.isDoubleOrNothing) {
            buffMultiplier = Math.random() < HALF_DOUBLE_NOTHING ? 0 : 2;
        }

        if (shrine.objectType === MapObjectType.HealingShrine) {
            player.hp = Math.min(player.maxHp, player.hp + 2 * buffMultiplier);
        } else if (shrine.objectType === MapObjectType.CombatShrine) {
            player.attack = player.attack + 1 * buffMultiplier;
            player.defense = player.defense + 1 * buffMultiplier;
            player.shrineBuffs = { bonusAmount: buffMultiplier, turnsLeft: 2 };

            Logger.warn(`Player ${player.name} received a combat buff from the shrine! Attack: ${player.attack}, Defense: ${player.defense}`);
        }

        if (buffMultiplier === 0) payload.DoubleOrNothingSuccess = false;
        else if (buffMultiplier === 2) payload.DoubleOrNothingSuccess = true;

        shrine.turnLeftDeactivated = 3;
    }

    startCombat(roomId: string, attackerId: string, defenderId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return false;

        const attacker = game.players.find((p) => p.id === attackerId);
        const defender = game.players.find((p) => p.id === defenderId);
        if (!attacker || !defender) return false;

        if (!game.turnOrder || game.turnOrder[game.currentTurnIndex] !== attacker.id) {
            Logger.warn(`Ce n'est pas le tour de l'attaquant (${attacker.name}) dans la room ${roomId}.`);
            return false;
        }

        if (!arePositionAdjacent(attacker.position, defender.position)) {
            Logger.warn(`Les joueurs ne sont pas adjacents dans la room ${roomId}.`);
            return false;
        }

        const pausedTurnRemainingSeconds = this.timer.getCurrentTime(roomId);
        this.timer.stopTimer(roomId);
        game.activeCombat = {
            attackerId,
            defenderId,
            roundTimeSeconds: 10,
            pausedTurnRemainingSeconds,
            postures: {
                [attackerId]: CombatPosture.None,
                [defenderId]: CombatPosture.None,
            },
        };

        return true;
    }

    submitCombatPosture(roomId: string, playerId: string, posture: CombatPosture): SubmitCombatPostureResult | null {
        const game = this.getGameByRoomId(roomId);
        const combatContext = this.combatResolutionService.getCombatContext(game, playerId);
        if (!combatContext) return null;

        const roundPostures = this.combatResolutionService.submitPlayerPosture(combatContext.game, playerId, posture);
        if (!roundPostures) return { roundResolved: false, isGameOver: false };

        const combatRound = this.combatResolutionService.resolveCombatRound( 
            combatContext, roundPostures.attackerPosture, roundPostures.defenderPosture,
        );

        if (!this.combatResolutionService.isCombatFinished(combatContext.attacker, combatContext.defender)) {
            return { roundResolved: true, combatRound, isGameOver: false };
        }

        return this.finishCombat(roomId, combatContext, combatRound);
    }

    private emitTurnUpdate(roomId: string, payload: NewTurnPayload): void {
        this.emitCallback?.(roomId, payload);
    }

    private finishCombat(roomId: string, combatContext: CombatContext, combatRound: CombatRoundDetails): SubmitCombatPostureResult {
        const pausedTurnRemainingSeconds = combatContext.game.activeCombat?.pausedTurnRemainingSeconds ?? 0;
        const battlePayload = this.combatResolutionService.createBattlePayload(combatRound);
        const result = this.combatResolutionService.finalizeCombatAfterRound(
            combatContext.game, battlePayload, combatContext.attacker, combatContext.defender,
        );

        const attackerWon = result.payload.winnerId === combatContext.attacker.id;
        const shouldResumeAttackerTurn = attackerWon && pausedTurnRemainingSeconds > 0;

        combatContext.game.activeCombat = null;

        if (shouldResumeAttackerTurn) {
            result.payload.remainingTurnSeconds = pausedTurnRemainingSeconds;
            this.timer.startTurnTimer(roomId, pausedTurnRemainingSeconds);
        }

        if (result.flagPayload) {
            this.handleUpdateFlag(roomId, result.flagPayload);
            this.broadcastService.emitUpdateFlag(roomId, result.flagPayload);
        }

        return {
            roundResolved: true,
            combatRound,
            battlePayload: result.payload,
            isGameOver: result.isGameOver,
            shouldAdvanceTurn: !result.isGameOver && !shouldResumeAttackerTurn,
        };
    }

    resolveCombatRoundOnTimeout(roomId: string): SubmitCombatPostureResult | null {
        const game = this.getGameByRoomId(roomId);
        if (!game?.activeCombat) return null;

        const attackerId = game.activeCombat.attackerId;
        const defenderId = game.activeCombat.defenderId;

        const combatContext = this.combatResolutionService.getCombatContext(game, attackerId);
        if (!combatContext) return null;

        const attackerPosture = game.activeCombat.postures[attackerId] ?? CombatPosture.None;
        const defenderPosture = game.activeCombat.postures[defenderId] ?? CombatPosture.None;

        const combatRound = this.combatResolutionService.resolveCombatRound(
            combatContext, attackerPosture, defenderPosture,
        );

        if (!this.combatResolutionService.isCombatFinished(combatContext.attacker, combatContext.defender)) {
            return {
                roundResolved: true, combatRound, isGameOver: false,
            };
        }

        return this.finishCombat(roomId, combatContext, combatRound);
    }

    handleUpdateFlag(roomId: string, payload: UpdateFlagPayload): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === payload.playerId);
        if (!player) return false;

        player.hasFlag = payload.flagStatus;

        return true;
    }
}
