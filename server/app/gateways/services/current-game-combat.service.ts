import { CurrentGamesService, SubmitCombatPostureResult } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { ActiveCombatPayload, SubmitCombatPosturePayload } from '@common/interfaces/game.interface';
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
            [client.id, payload.defenderId],
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
                this.broadcastService.emitGameOver(roomId, result.battlePayload.winnerId);
            }

            return;
        }

        if (result.roundResolved && game?.activeCombat) {
            this.broadcastService.emitCombatStarted(
                [game.activeCombat.attackerId, game.activeCombat.defenderId],
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
