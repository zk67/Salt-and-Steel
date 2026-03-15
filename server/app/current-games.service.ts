import { Timer } from '@app/game-timer';
import { MAX_VICTORIES, TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { BattleWonPayload, Game, NewTurnPayload, ToggleDebugPayload, TurnPhase } from '@common/types/game.interface';
import { DIRECTION, TILE_ENERGY_COST } from '@common/types/game.record';
import { MapObjectType } from '@common/types/map.interface';
import { Player } from '@common/types/player.interface';
import { Injectable, Logger } from '@nestjs/common';

const RANDOM_RANGE = 0.5;

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;
    private selectedAvatarsByRoom = new Map<string, Map<string, string>>();//cle1:roomId ,(2:clientId ,3:avatar)

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
            let newName = player.name;
            let counter = 2;
            while (game.players.some((p) => p.name === newName)) {
                newName = `${player.name}-${counter}`;
                counter++;
            }
            player.name = newName;
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
        return true;
    }

    movePlayer(roomId: string, playerId: string, direction: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        const [dx, dy] = DIRECTION[direction];

        const movementCost = TILE_ENERGY_COST[game._game.tiles[player.y + dy][player.x + dx].tileType];

        if (player.movementPoints < movementCost) {
            return false;
        }

        player.movementPoints -= movementCost;
        player.x += dx;
        player.y += dy;

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

        const spawnPoints: { x: number; y: number }[] = [];
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
            player.x = shuffled[index].x;
            player.y = shuffled[index].y;
            game.spawnPoints.set(player.id, { x: shuffled[index].x, y: shuffled[index].y });
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

    debugMove(roomId: string, playerId: string, x: number, y: number): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        if (player.id !== game.turnOrder[game.currentTurnIndex]) return false;

        player.x = x;
        player.y = y;

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

        const dx = Math.abs(winner.x - loser.x);
        const dy = Math.abs(winner.y - loser.y);
        const areAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
        if (!areAdjacent) {
            Logger.warn(`Les joueurs ne sont pas sur des tiles adjacentes: winner (${winner.x},${winner.y}), loser (${loser.x},${loser.y})`);
            return [battlePayload, false, false];
        }

        winner.victoryPoints = (winner.victoryPoints || 0) + 1;
        const isGameOver = winner.victoryPoints >= MAX_VICTORIES;

        const loserSpawn = game.spawnPoints?.get(loser.id);
        if (!loserSpawn) {
            Logger.warn(`Le point de départ du joueur perdant est introuvable`);
            return [battlePayload, false, false];
        }

        //TODO: Vérifier que le point de départ n'est pas occupé. Sinon, trouver la case libre la plus proche.

        loser.x = loserSpawn.x;
        loser.y = loserSpawn.y;

        battlePayload.loserPos = {
            x: loserSpawn.x,
            y: loserSpawn.y,
        };

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
            .filter(game => game.players.length < game._game.maxPlayers && !game.currentPhase)
            .map(game => {
                return { roomId: game.roomId, game: game._game, playerCount: game.players.length };
            });
    }

    canJoinGame(roomId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) {
            return false;
        }
        return game.players.length < game._game.maxPlayers;
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
    spawnPoints?: Map<string, { x: number; y: number }>;
    idHost?: string;
    debugMode?: boolean;
}

export interface JoinableGameSummary {
    roomId: string;
    game: Game;
    playerCount: number;
}

