import { JoinableGameSummary, PlayableGame } from '@app/interface/game.interface';
import { CombatRoundService, CombatResolutionResult } from '@app/service/combat-round.service';
import { GameLifecycleService } from '@app/service/game-lifecycle.service';
import { RoomPlayerStateService } from '@app/service/room-player-state.service';
import { TileActionService } from '@app/service/tile-action.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { Timer } from '@app/utils/game-timer';
import { BattleWonPayload, Game, NewTurnPayload, ToggleDebugPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { MAX_VICTORIES } from '@common/types/game.constant';
import { DIRECTION_STRING } from '@common/types/game.record';
import { addPositions, arePositionAdjacent, findNearestFreeSpawn, isValidTile, Position, TILE_MOVEMENT_COST } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;
    private roomPlayerStateService = new RoomPlayerStateService();
    private combatRoundService = new CombatRoundService();
    private tileActionService = new TileActionService();
    private gameLifecycleService = new GameLifecycleService();
    private turnFlowService = new TurnFlowService();

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
        if (!game) return false;

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

    private emitTurnUpdate(roomId: string, payload: NewTurnPayload): void {
        this.emitCallback?.(roomId, payload);
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

    battleWon(roomId: string, battlePayload: BattleWonPayload, attackerId: string): [BattleWonPayload, boolean, boolean] {
        const game = this.getGameByRoomId(roomId);
        if (!game) return [battlePayload, false, false];
        const attacker = game.players.find(p => p.id === attackerId);
        const defender = game.players.find(p => p.id === battlePayload.loserId);
        if (!attacker || !defender) {
            return [battlePayload, false, false];
        }
        if (!game.turnOrder || game.turnOrder[game.currentTurnIndex] !== attacker.id) {
            Logger.warn(`Ce n'est pas le tour de l'attaquant (${attacker.name}) dans la room ${roomId}.`);
            return [battlePayload, false, false];
        }
        if (!arePositionAdjacent(attacker.position, defender.position)) {
            Logger.warn(`Les joueurs ne sont pas sur des tiles adjacentes: attacker (${attacker.position.x},${attacker.position.y}),
                defender (${defender.position.x},${defender.position.y})`);
            return [battlePayload, false, false];
        }
        const resolution: CombatResolutionResult | null = this.combatRoundService.resolveCombatUntilWinner(game, attacker, defender);
        if (!resolution) {
            Logger.warn(`Combat non résolu proprement entre ${attacker.name} et ${defender.name} dans la room ${roomId}.`);
            return [battlePayload, false, false];
        }
        const { winner, loser, winnerHp, lastRound } = resolution;
        battlePayload.winnerId = winner.id;
        battlePayload.loserId = loser.id;
        battlePayload.combatRound = lastRound;
        battlePayload.winnerHp = winnerHp;
        battlePayload.loserHp = loser.maxHp ?? loser.hp ?? 0;
        winner.hp = winnerHp;
        loser.hp = loser.maxHp ?? loser.hp;
        winner.victoryPoints = (winner.victoryPoints || 0) + 1;
        const isGameOver = winner.victoryPoints >= MAX_VICTORIES;
        const loserSpawn = game.spawnPoints?.get(loser.id);
        if (!loserSpawn) {
            Logger.warn(`Le point de départ du joueur perdant est introuvable`);
            return [battlePayload, false, false];
        }
        const respawnPos = findNearestFreeSpawn(game._game.tiles, loserSpawn, game.players, loser.id);
        loser.position = respawnPos;
        battlePayload.loserPos = respawnPos;
        return [battlePayload, true, isGameOver];
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
        if (game) {
            return this.roomPlayerStateService.getUnavailableAvatars(roomId, game.players);
        } else {
            return [];
        }
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

    doActionAtTile(roomId: string, playerId: string, position: Position): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        if (!this.turnFlowService.isCurrentPlayerTurn(game, player)) {
            Logger.warn(`Ce n'est pas le tour du joueur (${player.name}) dans la room ${roomId}.`);
            return false;
        }

        if (!arePositionAdjacent(player.position, position)) {
            Logger.warn(`Le joueur (${player.name}) ne peut pas interagir avec une tile non adjacente.
                 Position du joueur: (${player.position.x},${player.position.y}), position ciblée: (${position.x},${position.y})`);
            return false;
        }

        if (player.actionsLeft <= 0) {
            Logger.warn(`Le joueur (${player.name}) n'a plus d'action restante pour interagir avec la tile.
                 Actions restantes: ${player.actionsLeft}`);
            return false;
        }

        const tile = game._game.tiles[position.y][position.x];
        if (!this.tileActionService.applyAction(player, tile)) {
            Logger.warn(`La tile ciblée n'est pas une mapObject interactive pour le joueur (${player.name}).
                    Position du joueur: (${player.position.x},${player.position.y}), position ciblée: (${position.x},${position.y})`);
            return false;
        }

        return true;
    }
}
