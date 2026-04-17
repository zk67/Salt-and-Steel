import { SubmitCombatPostureResult } from '@app/service/current-games-combat-resolution.service';
import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { ActiveCombatPayload, BattleWonPayload, CombatPosture, SubmitCombatPosturePayload } from '@common/interfaces/game.interface';
import { Profile } from '@common/interfaces/player.interface';
import { getVPTurnDelayMs } from '@common/types/player.constants';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';

const TIME_ROUND = 10;
const TIME_POSTURE = 1000;

@Injectable()
export class CurrentGameCombatService {
    private combatRoundTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private virtualPostureTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

    constructor(
        private readonly currentGamesService: CurrentGamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
    ) {}

    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        const room = getRoomIdFromSocket(client);
        this.startCombat(room, payload.attackerId, payload.defenderId);
    }

    startCombat(roomId: string, attackerId: string, defenderId: string): void {
        this.startCombatFlow(roomId, attackerId, defenderId);
    }

    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game?.activeCombat) {
            return;
        }

        this.submitCombatPosture(room, client.id, payload.posture);
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

        this.clearRoundState(roomId);
        game.activeCombat = null;

        if (winner.id === attackerId && pausedTurnRemainingSeconds > 0) {
            payload.remainingTurnSeconds = pausedTurnRemainingSeconds;
        }

        this.broadcastService.emitBattleWon(roomId, payload);

        if (payload.remainingTurnSeconds !== undefined) {
            this.currentGamesService.resumeTurnTimer(roomId, pausedTurnRemainingSeconds);
        } else {
            this.currentGamesService.nextPlayerTurn(roomId);
        }
        return payload;
    }

    startCombatRoundTimer(roomId: string): void {
        this.scheduleCombatRoundTimeout(roomId);
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

    private clearVirtualPostureTimers(roomId: string): void {
        const timers = this.virtualPostureTimers.get(roomId);
        if (!timers) {
            return;
        }

        for (const timer of timers) {
            clearTimeout(timer);
        }

        this.virtualPostureTimers.delete(roomId);
    }

    private clearRoundState(roomId: string): void {
        this.clearCombatRoundTimer(roomId);
        this.clearVirtualPostureTimers(roomId);
    }

    private scheduleCombatRoundTimeout(roomId: string): void {
        this.clearCombatRoundTimer(roomId);

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const activeCombat = game?.activeCombat;
        if (!activeCombat) return;

        const timeout = setTimeout(() => {
            const result = this.currentGamesService.resolveCombatRoundOnTimeout(roomId);
            if (!result) {
                return;
            }

            this.handleCombatResolution(roomId, result);
        }, activeCombat.roundTimeSeconds * TIME_POSTURE);

        this.combatRoundTimers.set(roomId, timeout);
    }

    private processCombatResult(roomId: string, result: SubmitCombatPostureResult): void {
        const game = this.currentGamesService.getGameByRoomId(roomId);
        if (!result.roundResolved) {
            return;
        }

        if (result.roundResolved && result.combatRound) {
            this.broadcastService.emitCombatRoundDetailsToRoom(roomId, result.combatRound);
        }

        if (result.battlePayload) {
            const payloadWithoutRound = { ...result.battlePayload };
            delete payloadWithoutRound.combatRound;

            this.broadcastService.emitBattleWon(roomId, payloadWithoutRound);

            if (result.isGameOver) {
                this.currentGamesService.gameOver(roomId, {
                    winnerId: result.battlePayload.winnerId,
                    gameDurationSeconds: 0, endedByAbandon: false,
                });
                return;
            }

            if (result.shouldAdvanceTurn) {
                this.currentGamesService.nextPlayerTurn(roomId);
            } else {
                const currentPlayerId = game?.turnOrder?.[game.currentTurnIndex];
                const currentPlayer = game?.players.find(p => p.id === currentPlayerId);
                if (currentPlayer?.isVirtual) {
                    setTimeout(() => this.currentGamesService.executeVirtualPlayerTurn(roomId, currentPlayerId), getVPTurnDelayMs());
                }
            }

            return;
        }

        if (game?.activeCombat) {
            this.broadcastService.emitCombatStarted(roomId, {
                attackerId: game.activeCombat.attackerId,
                defenderId: game.activeCombat.defenderId,
                roundTimeSeconds: game.activeCombat.roundTimeSeconds,
            });

            this.scheduleCombatRoundTimeout(roomId);
            this.scheduleVirtualPlayerPostures(roomId);
        }
    }

    private handleCombatResolution(roomId: string, result: SubmitCombatPostureResult): void {
        if (result.roundResolved) {
            this.clearRoundState(roomId);
        }

        this.processCombatResult(roomId, result);
    }

    private submitCombatPosture(roomId: string, playerId: string, posture: CombatPosture): void {
        const result = this.currentGamesService.submitCombatPosture(roomId, playerId, posture);
        if (!result) {
            return;
        }

        this.handleCombatResolution(roomId, result);
    }

    private startCombatFlow(roomId: string, attackerId: string, defenderId: string): void {
        const combatStarted = this.currentGamesService.startCombat(roomId, attackerId, defenderId);
        if (!combatStarted) {
            return;
        }

        this.broadcastService.emitCombatStarted(roomId, {
            attackerId,
            defenderId,
            roundTimeSeconds: TIME_ROUND,
        });

        this.scheduleCombatRoundTimeout(roomId);
        this.scheduleVirtualPlayerPostures(roomId);
    }

    private scheduleVirtualPlayerPostures(roomId: string): void {
        this.clearVirtualPostureTimers(roomId);

        const game = this.currentGamesService.getGameByRoomId(roomId);
        const activeCombat = game?.activeCombat;
        if (!game || !activeCombat) {
            return;
        }

        const timers: ReturnType<typeof setTimeout>[] = [];
        let accumulatedDelayMs = 0;

        for (const playerId of [activeCombat.attackerId, activeCombat.defenderId]) {
            const player = game.players.find((currentPlayer) => currentPlayer.id === playerId);
            if (!player?.isVirtual) {
                continue;
            }

            const posture = player.virtualProfile === Profile.Aggressive
                ? CombatPosture.Offensive
                : CombatPosture.Defensive;

            accumulatedDelayMs += getVPTurnDelayMs();
            const timer = setTimeout(() => {
                this.submitVirtualPlayerPosture(roomId, playerId, posture);
            }, accumulatedDelayMs);
            timers.push(timer);
        }

        if (timers.length > 0) {
            this.virtualPostureTimers.set(roomId, timers);
        }
    }

    private submitVirtualPlayerPosture(roomId: string, playerId: string, posture: CombatPosture): void {
        const game = this.currentGamesService.getGameByRoomId(roomId);
        if (!game?.activeCombat) {
            return;
        }

        const isParticipant =
            playerId === game.activeCombat.attackerId ||
            playerId === game.activeCombat.defenderId;
        if (!isParticipant) {
            return;
        }

        this.submitCombatPosture(roomId, playerId, posture);
    }

}
