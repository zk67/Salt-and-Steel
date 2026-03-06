import { Timer } from '@app/game-timer';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { Game, NewTurnPayload, TurnPhase } from '@common/types/game.interface';
import { DIRECTION, TILE_ENERGY_COST } from '@common/types/game.record';
import { Player } from '@common/types/player.interface';
import { Injectable, Logger } from '@nestjs/common';

const RANDOM_RANGE = 0.5;

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);
    private emitCallback: ((roomId: string, payload: NewTurnPayload) => void) | undefined;

    setEmitCallback(callback: (roomId: string, payload: NewTurnPayload) => void): void {
        this.emitCallback = callback;
    }

    createGame(game: Game, roomId: string): void {
        this.games.push({ _game: game, roomId, players: [] });
    }

    addPlayerToGame(roomId: string, player: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (game) {
            game.players.push(player);
            Logger.log(`Player ${player.name} added to game in room ${roomId}. Total players: ${game.players.length}`);
        }
    }

    getPlayersToGame(roomId: string): Player[] {
        const game = this.getGameByRoomId(roomId);
        return game ? game.players : [];
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

        if (player.energy < energycost) {
            return false;
        }

        player.energy -= energycost;
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
            game.currentPhase = TurnPhase.WaitTurn;
            const lastPlayerId = game.turnOrder[game.currentTurnIndex];
            const lastPlayer = game.players.find(p => p.id === lastPlayerId);
            if (!lastPlayer) return;
            lastPlayer.energy = 0;
            game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
            this.timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);
            this.sendTurnUpdate(game);
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

    private sendTurnUpdate(game: PlayableGame): void {
        const turnPayload: NewTurnPayload = {
            phase: game.currentPhase,
            playerId: game.turnOrder[game.currentTurnIndex],
        };

        this.emitCallback?.(game.roomId, turnPayload);
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
