import { CurrentGamesService, SubmitCombatPostureResult } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { ActiveCombatPayload, BattleWonPayload, SubmitCombatPosturePayload } from '@common/interfaces/game.interface';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';


const TIME_ROUND = 10;
const TIME_POSTURE = 1000;

@Injectable()
export class CurrentGameCombatService {
    private combatRoundTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private readonly currentGamesService: CurrentGamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
    ) {}

    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        const room = getRoomIdFromSocket(client);
        const combatStarted = this.currentGamesService.startCombat(room, client.id, payload.defenderId);

        if (!combatStarted) {
            return;
        }

        this.scheduleCombatRoundTimeout(room);
        this.broadcastService.emitCombatStarted(
            room,
            {
                attackerId: client.id,
                defenderId: payload.defenderId,
                roundTimeSeconds: TIME_ROUND,
            },
        );
    }

    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        const room = getRoomIdFromSocket(client);
        const result = this.currentGamesService.submitCombatPosture(room, client.id, payload.posture);

        if (!result) {
            return;
        }

        if (result.roundResolved) {
            this.clearCombatRoundTimer(room);
        }

        this.processCombatResult(room, result);
    }

    handleCombatSurrender(roomId: string, surrenderingPlayerId: string): BattleWonPayload | null {
        const game = this.currentGamesService.getGameByRoomId(roomId);
        if (!game?.activeCombat) {
            return null;
        }

        const { attackerId, defenderId, pausedTurnRemainingSeconds } = game.activeCombat;
        const isCombatParticipant = surrenderingPlayerId === attackerId || surrenderingPlayerId === defenderId;
        if (!isCombatParticipant) {
            return null;
        }

        const winnerId = surrenderingPlayerId === attackerId ? defenderId : attackerId;
        const loserId = surrenderingPlayerId;
        const winner = game.players.find((player) => player.id === winnerId);
        const loser = game.players.find((player) => player.id === loserId);

        if (!winner || !loser) {
            return null;
        }

        const payload = this.createSurrenderPayload(winner, loser);
        this.updateSurrenderCombatStats(winner, loser);

        this.clearCombatRoundTimer(roomId);
        game.activeCombat = null;

        if (winner.id === attackerId && pausedTurnRemainingSeconds > 0) {
            payload.remainingTurnSeconds = pausedTurnRemainingSeconds;
            this.currentGamesService.resumeTurnTimer(roomId, pausedTurnRemainingSeconds);
        } else {
            this.currentGamesService.nextPlayerTurn(roomId);
        }

        this.broadcastService.emitBattleWon(roomId, payload);
        return payload;
    }

    private createSurrenderPayload(
        winner: { id: string; hp?: number },
        loser: { id: string; hp?: number; position: BattleWonPayload['loserPos'] },
    ): BattleWonPayload {
        return {
            winnerId: winner.id,
            loserId: loser.id,
            winnerHp: winner.hp ?? 0,
            loserHp: loser.hp ?? 0,
            loserPos: loser.position,
        };
    }

    private updateSurrenderCombatStats(
        winner: { stats: { victoryPoints?: number; combatPoints?: number } },
        loser: { stats: { combatPoints?: number; defeatPoints?: number } },
    ): void {
        winner.stats.victoryPoints = (winner.stats.victoryPoints || 0) + 1;
        winner.stats.combatPoints = (winner.stats.combatPoints || 0) + 1;
        loser.stats.combatPoints = (loser.stats.combatPoints || 0) + 1;
        loser.stats.defeatPoints = (loser.stats.defeatPoints || 0) + 1;
    }

    private clearCombatRoundTimer(roomId: string): void {
        const timer = this.combatRoundTimers.get(roomId);
        if (timer) {
            clearTimeout(timer);
            this.combatRoundTimers.delete(roomId);
        }
    }

    private scheduleCombatRoundTimeout(roomId: string): void {
        this.clearCombatRoundTimer(roomId);

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const activeCombat = game?.activeCombat;
        if (!activeCombat) {
            return;
        }

        const timeout = setTimeout(() => {
            const result = this.currentGamesService.resolveCombatRoundOnTimeout(roomId);
            if (!result) {
                return;
            }

            this.processCombatResult(roomId, result);
        }, activeCombat.roundTimeSeconds * TIME_POSTURE);

        this.combatRoundTimers.set(roomId, timeout);
    }

    private processCombatResult(roomId: string, result: SubmitCombatPostureResult): void {
        const game = this.currentGamesService.getGameByRoomId(roomId);

        if (result.roundResolved && result.combatRound) {
            this.broadcastService.emitCombatRoundDetails(
                [result.combatRound.attacker.playerId, result.combatRound.defender.playerId],
                result.combatRound,
            );
        }

        if (result.battlePayload) {
            this.clearCombatRoundTimer(roomId);

            const payloadWithoutRound = { ...result.battlePayload };
            delete payloadWithoutRound.combatRound;

            this.broadcastService.emitBattleWon(roomId, payloadWithoutRound);

            if (result.isGameOver) {
                this.currentGamesService.gameOver(roomId, result.battlePayload.winnerId);
                return;
            }

            if (result.shouldAdvanceTurn) {
                this.currentGamesService.nextPlayerTurn(roomId);
            }

            return;
        }

        if (result.roundResolved && game?.activeCombat) {
            this.broadcastService.emitCombatStarted(
                roomId,
                {
                    attackerId: game.activeCombat.attackerId,
                    defenderId: game.activeCombat.defenderId,
                    roundTimeSeconds: game.activeCombat.roundTimeSeconds,
                },
            );

            this.scheduleCombatRoundTimeout(roomId);
        }
    }
}
