import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { PlayableGame } from '@app/interface/game.interface';
import { CombatContext, CombatResolutionService } from '@app/service/combat-resolution.service';
import { CombatRoundService } from '@app/service/combat-round.service';
import { Timer } from '@app/utils/game-timer';
import { BattleWonPayload, CombatRoundDetails, UpdateFlagPayload } from '@common/interfaces/game.interface';
import { CombatPosture } from '@common/enums/game.enums';
import { COMBAT_TIMER } from '@common/types/player.constants';
import { arePositionAdjacent } from '@common/utils/map.utils';
import { Injectable, Logger } from '@nestjs/common';

export type SubmitCombatPostureResult = {
    roundResolved: boolean;
    combatRound?: CombatRoundDetails;
    battlePayload?: BattleWonPayload;
    isGameOver: boolean;
    shouldAdvanceTurn?: boolean;
};

@Injectable()
export class CurrentGamesCombatService {
    private combatRoundService = new CombatRoundService();
    private combatResolutionService: CombatResolutionService;

    constructor(
        private readonly broadcastService: CurrentGameBroadcastService,
        private readonly timer: Timer,
    ) {
        this.combatResolutionService = new CombatResolutionService(this.combatRoundService);
    }

    startCombat(game: PlayableGame, attackerId: string, defenderId: string): boolean {
        if (game.activeCombat) {
            Logger.warn('blocked: activeCombat exists'); return false;
        }

        const attacker = game.players.find((player) => player.id === attackerId);
        const defender = game.players.find((player) => player.id === defenderId);
        if (!attacker || !defender) {
            Logger.warn(`blocked: attacker=${!!attacker}, defender=${!!defender}`); return false;
        }

        if (!game.turnOrder || game.turnOrder[game.currentTurnIndex] !== attacker.id) return false;
        if (!arePositionAdjacent(attacker.position, defender.position)) return false;

        const pausedTurnRemainingSeconds = this.timer.getCurrentTime(game.roomId);
        this.timer.stopTimer(game.roomId);
        game.activeCombat = {
            attackerId,
            defenderId,
            roundTimeSeconds: COMBAT_TIMER,
            pausedTurnRemainingSeconds,
            postures: {
                [attackerId]: CombatPosture.None,
                [defenderId]: CombatPosture.None,
            },
        };

        return true;
    }

    submitCombatPosture(game: PlayableGame, playerId: string, posture: CombatPosture): SubmitCombatPostureResult | null {
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

        return this.finishCombat(game, combatContext, combatRound);
    }

    resolveCombatRoundOnTimeout(game: PlayableGame): SubmitCombatPostureResult | null {
        if (!game.activeCombat) return null;

        const { attackerId, defenderId } = game.activeCombat;
        const combatContext = this.combatResolutionService.getCombatContext(game, attackerId);
        if (!combatContext) return null;
        const attackerPosture = game.activeCombat.postures[attackerId] ?? CombatPosture.None;
        const defenderPosture = game.activeCombat.postures[defenderId] ?? CombatPosture.None;
        const combatRound = this.combatResolutionService.resolveCombatRound(
            combatContext, attackerPosture, defenderPosture,
        );

        if (!this.combatResolutionService.isCombatFinished(combatContext.attacker, combatContext.defender)) {
            return { roundResolved: true, combatRound, isGameOver: false };
        }

        return this.finishCombat(game, combatContext, combatRound);
    }

    handleUpdateFlag(game: PlayableGame, payload: UpdateFlagPayload): boolean {
        const player = game.players.find(findPlayer => findPlayer.id === payload.playerId);
        if (!player) return false;

        player.hasFlag = payload.flagStatus;
        return true;
    }

    private finishCombat(
        game: PlayableGame,
        combatContext: CombatContext,
        combatRound: CombatRoundDetails,
    ): SubmitCombatPostureResult {
        const pausedTurnRemainingSeconds = combatContext.game.activeCombat?.pausedTurnRemainingSeconds ?? 0;
        const battlePayload = this.combatResolutionService.createBattlePayload(combatRound);
        const result = this.combatResolutionService.finalizeCombatAfterRound(
            combatContext.game, battlePayload, combatContext.attacker, combatContext.defender,
        );

        const attackerWon = result.payload.doubleKo !== true && result.payload.winnerId === combatContext.attacker.id;
        const shouldResumeAttackerTurn = attackerWon && pausedTurnRemainingSeconds > 0;

        combatContext.game.activeCombat = null;

        if (shouldResumeAttackerTurn) {
            result.payload.remainingTurnSeconds = pausedTurnRemainingSeconds;
            this.timer.startTurnTimer(game.roomId, pausedTurnRemainingSeconds);
        }

        if (result.flagPayload) {
            this.handleUpdateFlag(game, result.flagPayload);
            this.broadcastService.emitUpdateFlag(game.roomId, result.flagPayload);
        }

        return {
            roundResolved: true,
            combatRound,
            battlePayload: result.payload,
            isGameOver: result.isGameOver,
            shouldAdvanceTurn: !result.isGameOver && !shouldResumeAttackerTurn,
        };
    }
}