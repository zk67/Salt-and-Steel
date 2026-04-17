import { PlayableGame } from '@app/interface/game.interface';
import { Timer } from '@app/utils/game-timer';
import { NewTurnPayload } from '@common/interfaces/game.interface';
import { TurnPhase } from '@common/enums/game.enums';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { Logger } from '@nestjs/common';
import { getVPTurnDelayMs } from '@common/types/player.constants';

export class TurnFlowService {
    constructor(private readonly emitShrineBuffOff: (roomId: string, playerId: string) => void) {}

    startGameTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        game.currentPhase = TurnPhase.WaitTurn;
        game.currentTurnIndex = 0;

        timer.startTurnTimer(game.roomId, TIMER_WAIT_TURN);
        this.emitTurnUpdate(game, emitTurnUpdate);
    }

    changeTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void,
     executeVirtualPlayerTurn: (roomId: string, playerId: string) => void): void {
        if (!game.turnOrder) {
            return;
        }
        

        if (game.currentPhase === TurnPhase.Turn) {
            this.nextPlayerTurn(game, timer, emitTurnUpdate);
            return;
        }

        game.currentPhase = TurnPhase.Turn;

        if (typeof game.totalTurns === 'number') {
            game.totalTurns++;
        } else {
            game.totalTurns = 1;
        }

        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        const currentPlayer = game.players.find((p) => p.id === currentPlayerId);
        if (!currentPlayer) {
            return;
        }

        currentPlayer.movementPoints = currentPlayer.speed;
        currentPlayer.actionsLeft = 1;

        this.emitTurnUpdate(game, emitTurnUpdate);
        timer.startTurnTimer(game.roomId, TIMER_TURN);

        if (game.currentPhase !== TurnPhase.Turn) return;

        Logger.log(`changeTurn: currentPlayerId=${currentPlayerId}, isVirtual=${currentPlayer?.isVirtual}`);

        if (currentPlayer?.isVirtual) {
            setTimeout(
                () => executeVirtualPlayerTurn(game.roomId, currentPlayerId),
                getVPTurnDelayMs(),
            );
        }
    }

    nextPlayerTurn(game: PlayableGame, timer: Timer, emitTurnUpdate: (roomId: string, payload: NewTurnPayload) => void): void {
        if (!game.turnOrder) {
            return;
        }

        timer.stopTimer(game.roomId);
        game.currentPhase = TurnPhase.WaitTurn;
        game._game.shrine.forEach((s) => {
            if (s.turnLeftDeactivated > 0) {
                s.turnLeftDeactivated -= 1;
            }
        });

        const lastPlayerId = game.turnOrder[game.currentTurnIndex];
        const lastPlayer = game.players.find((p) => p.id === lastPlayerId);
        if (!lastPlayer) {
            return;
        }

        lastPlayer.movementPoints = 0;

        Logger.log(`Ending turn for player ${lastPlayer.name}`);
        if (lastPlayer.shrineBuffs) {
            lastPlayer.shrineBuffs.turnsLeft -= 1;
            Logger.warn(`Player ${lastPlayer.name} has ${lastPlayer.shrineBuffs.turnsLeft} turns left on their shrine buff.`);
            if (lastPlayer.shrineBuffs.turnsLeft <= 0) {
                Logger.warn(`Player ${lastPlayer.name}'s shrine buff has expired.`);
                lastPlayer.attack -= 1 * lastPlayer.shrineBuffs.bonusAmount;
                lastPlayer.defense -= 1 * lastPlayer.shrineBuffs.bonusAmount;
                lastPlayer.shrineBuffs = undefined;
                this.emitShrineBuffOff(game.roomId, lastPlayer.id);
            }

        }
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
            totalTurns: game.totalTurns ?? 0,
        });
    }
}
