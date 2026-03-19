import { Timer } from '@app/utils/game-timer';
import { BattleWonPayload, Game, NewTurnPayload, ToggleDebugPayload, TurnPhase } from '@common/interfaces/game.interface';
import { MapObjectType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { MAX_VICTORIES, TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { DIRECTION_STRING } from '@common/types/game.record';
import { Injectable, Logger } from '@nestjs/common';
import {
    addPositions,
    arePositionAdjacent,
    findNearestFreeSpawn,
    isValidTile,
    Position,
    TILE_MOVEMENT_COST,
} from '@common/utils/map.utils';

const RANDOM_RANGE = 0.5;

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;
    private selectedAvatarsByRoom = new Map<string, Map<string, string>>();//cle1:roomId ,(2:clientId ,3:avatar)
    private usedNameSuffixesByRoom = new Map<string, Map<string, number>>();

    setEmitCallback(callback: (roomId: string, payload: NewTurnPayload) => void): void {
        this.emitCallback = callback;
    }

    createGame(game: Game, roomId: string, gameId: string): void {
        game._id = gameId;
        this.games.push({ _game: game, roomId, players: [] });
    }

    private getOrCreateRoomNameRegistry(roomId: string): Map<string, number> {
        let roomRegistry = this.usedNameSuffixesByRoom.get(roomId);
        if (!roomRegistry) {
            roomRegistry = new Map<string, number>();
            this.usedNameSuffixesByRoom.set(roomId, roomRegistry);
        }
        return roomRegistry;
    }

    private buildUniquePlayerName(roomId: string, requestedName: string, currentPlayers: Player[]): string {
        const baseName = requestedName.trim();
        const roomRegistry = this.getOrCreateRoomNameRegistry(roomId);

        const baseNameAlreadyUsed = currentPlayers.some((p) => p.name === baseName);
        const trackedSuffix = roomRegistry.get(baseName) ?? 1;

        if (!baseNameAlreadyUsed && trackedSuffix === 1) {
            roomRegistry.set(baseName, 1);
            return baseName;
        }

        const nextSuffix = trackedSuffix + 1;
        roomRegistry.set(baseName, nextSuffix);
        return `${baseName}-${nextSuffix}`;
    }

    addPlayerToGame(roomId: string, player: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (game) {
            player.name = this.buildUniquePlayerName(roomId, player.name, game.players);
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
        return this.games.find(g => g.roomId === roomId);
    }

    removeGame(roomId: string): boolean {
        const index = this.games.findIndex((g) => g.roomId === roomId);
        if (index === -1) {
            return false;
        }

        this.games.splice(index, 1);
        this.usedNameSuffixesByRoom.delete(roomId);
        return true;
    }

    movePlayer(roomId: string, playerId: string, direction: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
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

        const shuffled = [...game.players].sort(() => Math.random() - RANDOM_RANGE);
        const sorted = shuffled.sort((a, b) => b.speed - a.speed);

        game.turnOrder = sorted.map(p => p.id);
        sorted.forEach((player, idx) => {
            player.turnOrder = idx;
        });
        this.allocateSpawnPoints(roomId);
        this.timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);

        game.currentPhase = TurnPhase.WaitTurn;
        game.currentTurnIndex = 0;

        this.sendTurnUpdate(game);

        return game;
    }

    allocateSpawnPoints(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        const nbPlayers = game.players.length;

        const spawnPoints: Position[] = [];
        for (let y = 0; y < game._game.tiles.length; y++) {
            for (let x = 0; x < game._game.tiles[y].length; x++) {
                if (game._game.tiles[y][x].mapObject === MapObjectType.SpawnPoint) {
                    spawnPoints.push({ x, y });
                }
            }
        }

        const shuffled = spawnPoints.sort(() => Math.random() - RANDOM_RANGE);

        game.spawnPoints = new Map();
        game.players.forEach((player, index) => {
            player.position = shuffled[index];
            game.spawnPoints.set(player.id, shuffled[index]);
        });

        shuffled.slice(nbPlayers).forEach(({ x, y }) => {
            game._game.tiles[y][x].mapObject = MapObjectType.None;
        });
    }

    changeTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || !game.turnOrder) return;

        if (game.currentPhase === TurnPhase.Turn) {
            this.nextPlayerTurn(roomId);
        } else {
            game.currentPhase = TurnPhase.Turn;
            const currentPlayerId = game.turnOrder[game.currentTurnIndex];
            const currentPlayer = game.players.find(p => p.id === currentPlayerId);
            if (!currentPlayer) return;

            currentPlayer.movementPoints = currentPlayer.speed;

            this.sendTurnUpdate(game);
            this.timer.startTurnTimer(game.roomId, TIMER_TURN);
        }
    }

    nextPlayerTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;

        this.timer.stopTimer(game.roomId); // Quand on fini en avance
        game.currentPhase = TurnPhase.WaitTurn;

        const lastPlayerId = game.turnOrder[game.currentTurnIndex];
        const lastPlayer = game.players.find(p => p.id === lastPlayerId);
        if (!lastPlayer) return;

        lastPlayer.movementPoints = 0;
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        this.timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);
        this.sendTurnUpdate(game);
    }

    private sendTurnUpdate(game: PlayableGame): void {
        const turnPayload: NewTurnPayload = {
            phase: game.currentPhase,
            playerId: game.turnOrder[game.currentTurnIndex],
        };

        this.emitCallback?.(game.roomId, turnPayload);
    }

    debugMove(roomId: string, playerId: string, position: Position): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        if (player.id !== game.turnOrder[game.currentTurnIndex]) return false;

        player.position = position;

        return true;
    }

    battleWon(roomId: string, battlePayload: BattleWonPayload): [BattleWonPayload, boolean, boolean] {
        const game = this.getGameByRoomId(roomId);
        if (!game) return [battlePayload, false, false];

        const winner = game.players.find(p => p.id === battlePayload.winnerId);
        const loser = game.players.find(p => p.id === battlePayload.loserId);
        if (!winner || !loser) return [battlePayload, false, false];

        if (!game.turnOrder || game.turnOrder[game.currentTurnIndex] !== winner.id) {
            // Pour le sprint 2 seulement celui qui initialise le combat peut gagner les points de victoire,
            //  donc on check que c'est bien son tour
            Logger.warn(`Ce n'est pas le tour du gagnant (${winner.name}) dans la room ${roomId}.`);
            return [battlePayload, false, false];
        }

        if (!arePositionAdjacent(winner.position, loser.position)) {
            Logger.warn(`Les joueurs ne sont pas sur des tiles adjacentes: winner (${winner.position.x},${winner.position.y}),
                 loser (${loser.position.x},${loser.position.y})`);
            return [battlePayload, false, false];
        }

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

        return [battlePayload, true, isGameOver]; // Retourner le payload et si la partie est terminée
    }

    validateEndTurnEarly(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        if (game.turnOrder[game.currentTurnIndex] !== player.id) {
            Logger.warn(`Ce n'est pas le tour du joueur (${player.name}) dans la room ${roomId}.`);
            return false;
        }

        return true;
    }

    removePlayerFromGame(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const playerIndex = game.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return false;

        if (game.turnOrder) {
            if (game.turnOrder[game.currentTurnIndex] === playerId) {
                this.nextPlayerTurn(roomId);
            }

            game.players.splice(playerIndex, 1);
            game.turnOrder = game.turnOrder.filter(id => id !== playerId);
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
        return this.games
            .filter(game => game.players.length < game._game.maxPlayers && game.currentPhase === undefined)
            .map(game => {
                return { roomId: game.roomId, game: game._game, playerCount: game.players.length };
            });
    }

    canJoinGame(roomId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) {
            return false;
        }
        return game.players.length < game._game.maxPlayers && game.currentPhase === undefined;
    }

    getUnavailableAvatars(roomId: string): string[] {
        const game = this.getGameByRoomId(roomId);
        if (game) {
            const waitingRoomAvatars = game.players.map(p => p.imageUrl).filter(Boolean);
            const roomMap = this.selectedAvatarsByRoom.get(roomId);
            const selectedAvatars = roomMap ? Array.from(roomMap.values()) : [];
            const allAvatars = waitingRoomAvatars.concat(selectedAvatars);
            return [...new Set(allAvatars)];
        } else {
            return [];
        }
    }

    setSelectedAvatar(roomId: string, clientId: string, avatar: string): void {
        if (!this.selectedAvatarsByRoom.has(roomId)) {
            this.selectedAvatarsByRoom.set(roomId, new Map<string, string>());
        }
        this.selectedAvatarsByRoom.get(roomId)?.set(clientId, avatar);
    }

    clearSelectedAvatar(roomId: string, clientId: string): void {
        const roomSelections = this.selectedAvatarsByRoom.get(roomId);
        if (roomSelections) {
            roomSelections.delete(clientId);
            if (roomSelections.size === 0) {
                this.selectedAvatarsByRoom.delete(roomId);
            }
        }
    }

    clearSelectedAvatarByClientId(clientId: string): string[] {
        const updatedRooms: string[] = [];
        for (const [roomId, selections] of this.selectedAvatarsByRoom.entries()) {
            if (!selections.has(clientId)) {
                continue;
            }
            selections.delete(clientId);
            updatedRooms.push(roomId);
            if (selections.size === 0) {
                this.selectedAvatarsByRoom.delete(roomId);
            }
        }
        return updatedRooms;
    }
}
export interface PlayableGame {
    _game: Game;
    roomId: string;
    players: Player[];
    turnOrder?: string[];
    currentTurnIndex?: number;
    currentPhase?: TurnPhase;
    spawnPoints?: Map<string, Position>;
    idHost?: string;
    debugMode?: boolean;
}

export interface JoinableGameSummary {
    roomId: string;
    game: Game;
    playerCount: number;
}

