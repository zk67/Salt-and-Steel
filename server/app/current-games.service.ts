import { Injectable } from '@nestjs/common';
import { DIRECTION, TILE_ENERGY_COST } from '@common/types/game.record';
import { Game } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';
import { Timer } from '@app/game-timer';

const RANDOM_RANGE = 0.5;
const TIMER_WAIT_TURN = 3;
const TIMER_TURN = 30;

@Injectable()
export class CurrentGamesService {
    private games: PlayableGame[] = [];
    private timer: Timer = new Timer(this);

    addGame(game: Game, roomId: string, players: Player[]): void {
        this.games.push({ _game: game, roomId, players });
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

    startGame(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game) return;
        const shuffled = [...game.players].sort(() => Math.random() - RANDOM_RANGE);
        game.turnOrder = shuffled.sort((a, b) => b.speed - a.speed).map(p => p.id);
        game.players.forEach(player => {
            player.energy = player.speed;
        });

        this.timer.startTurnTimer(roomId, TIMER_WAIT_TURN);

        game.currentPhase = TurnPhase.WaitTurn;
        game.currentTurnIndex = 0;
    }

    changeTurn(roomId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || !game.turnOrder) return;

        if (game.currentPhase === TurnPhase.WaitTurn) {
            game.currentPhase = TurnPhase.Turn;
            this.timer.startTurnTimer(roomId, TIMER_TURN);
        } else {
            const lastPlayerId = game.turnOrder[game.currentTurnIndex];
            const lastPlayer = game.players.find(p => p.id === lastPlayerId);
            if (!lastPlayer) return;

            lastPlayer.energy = 0;

            game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
            const currentPlayerId = game.turnOrder[game.currentTurnIndex];
            const currentPlayer = game.players.find(p => p.id === currentPlayerId);
            if (!currentPlayer) return;

            currentPlayer.energy = currentPlayer.speed;

            this.timer.startTurnTimer(roomId, TIMER_TURN);
        }
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

enum TurnPhase {
    WaitTurn,
    Turn,
}
