import { PlayableGame } from '@app/interface/game.interface';
import { Timer } from '@app/utils/game-timer';
import { NewTurnPayload, TurnPhase } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';

export class TurnFlowService {
    startGameTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        game.currentPhase = TurnPhase.WaitTurn;
        game.currentTurnIndex = 0;

        timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);
        this.emitTurnUpdate(game, emitTurnUpdate);
    }

    changeTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        if (!game.turnOrder) {
            return;
        }

        if (game.currentPhase === TurnPhase.Turn) {
            this.nextPlayerTurn(game, timer, emitTurnUpdate);
            return;
        }

        game.currentPhase = TurnPhase.Turn;
        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        const currentPlayer = game.players.find((p) => p.id === currentPlayerId);
        if (!currentPlayer) {
            return;
        }

        currentPlayer.movementPoints = currentPlayer.speed;
        this.emitTurnUpdate(game, emitTurnUpdate);
        timer.startTurnTimer(game.roomId, TIMER_TURN);
    }

    nextPlayerTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        if (!game.turnOrder) {
            return;
        }

        timer.stopTimer(game.roomId);
        game.currentPhase = TurnPhase.WaitTurn;

        const lastPlayerId = game.turnOrder[game.currentTurnIndex];
        const lastPlayer = game.players.find((p) => p.id === lastPlayerId);
        if (!lastPlayer) {
            return;
        }

        lastPlayer.movementPoints = 0;
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);
        this.emitTurnUpdate(game, emitTurnUpdate);
    }

    isCurrentPlayerTurn(game: PlayableGame, player: Player): boolean {
        return !!game.turnOrder && game.turnOrder[game.currentTurnIndex] === player.id;
    }

    isCurrentPlayerTurnById(game: PlayableGame, playerId: string): boolean {
        return !!game.turnOrder && game.turnOrder[game.currentTurnIndex] === playerId;
    }

    private emitTurnUpdate(game: PlayableGame, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        if (!game.turnOrder) {
            return;
        }

        emitTurnUpdate(game.roomId, {
            phase: game.currentPhase,
            playerId: game.turnOrder[game.currentTurnIndex],
        });
    }
}
