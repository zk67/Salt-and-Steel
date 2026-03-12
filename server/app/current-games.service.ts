import { Injectable, Logger } from '@nestjs/common';
import { DIRECTION, TILE_ENERGY_COST } from '@common/types/game.record';
import { Game, TurnPhase, NewTurnPayload, BattleWonPayload } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';
import { Timer } from '@app/game-timer';
import { TIMER_WAIT_TURN, TIMER_TURN, MAX_VICTORIES } from '@common/types/game.constant';

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

    // Create et add son similaire a decider lequel on garde, va dependre de comment on creer les games a partir de la waiting room
    addGame(game: Game, roomId: string, players: Player[]): void {
        this.games.push({ _game: game, roomId, players });
    }

    createGame(game: Game, roomId: string): void {
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
        }
    }

    getGameByRoomId(roomId: string): PlayableGame | undefined {
        return this.games.find(g => g.roomId === roomId);
    }

    movePlayer(roomId: string, playerId: string, direction: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        const [dx, dy] = DIRECTION[direction];

        const energycost = TILE_ENERGY_COST[game._game.tiles[player.y + dy][player.x + dx].tileType];

        if(player.energy < energycost) {
            return false;
        }

        player.energy -= energycost;
        player.x += dx;
        player.y += dy;

        return true;
    }

    startGame(roomId: string): PlayableGame {
        const game = this.getGameByRoomId(roomId);
        if (!game){
            Logger.warn(`Game not found for room ID: ${roomId}`);
            return;
        }
        const shuffled = [...game.players].sort(() => Math.random() - RANDOM_RANGE);
        game.turnOrder = shuffled.sort((a, b) => b.speed - a.speed).map(p => p.id);
        this.timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);

        game.currentPhase = TurnPhase.WaitTurn;
        game.currentTurnIndex = 0;

        this.sendTurnUpdate(game);

        return game;
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

            currentPlayer.energy = currentPlayer.speed;

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

        lastPlayer.energy = 0;
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
            return [battlePayload,false, false];
        }

        winner.victoryPoints = (winner.victoryPoints || 0) + 1;
        const isGameOver = winner.victoryPoints >= MAX_VICTORIES;

        // TODO: Ajouter le respawn point / position voulu dans le payload et update la position du loser

        return [battlePayload, true, isGameOver]; // Retourner le payload et si la partie est terminée
    }

    getJoinableGames(): JoinableGameSummary[] {
        return this.games
            .filter(game => game.players.length < game._game.maxPlayers)
            .map(game => {
                return {
                    roomId: game.roomId,
                    game: game._game,
                    playerCount: game.players.length};
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
        }else{
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
}

export interface JoinableGameSummary {
    roomId: string;
    game: Game;
    playerCount: number;
}
