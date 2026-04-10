import { computed, inject, Injectable, signal } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ActiveCombatPayload, BattleWonPayload, CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { movableTiles } from '@common/utils/map.utils';
import { GamePlayerStateService } from './game-player-state.service';
import { GameTurnService } from './game-turn.service';

@Injectable({
    providedIn: 'root',
})
export class GameCombatService {
    private combatStartHp = new Map<string, number>();
    private readonly combatRoundState = signal<CombatRoundDetails | null>(null);
    private readonly activeCombatState = signal<ActiveCombatPayload | null>(null);
    private readonly mapService = inject(MapService);
    private readonly socketService = inject(SocketClientService);
    private readonly playerState = inject(GamePlayerStateService);
    private readonly turnService = inject(GameTurnService);

    readonly currentCombatRound = computed(() => this.combatRoundState());
    readonly activeCombat = computed(() => this.activeCombatState());
    readonly isClientInActiveCombat = computed(() => {
        const combat = this.activeCombatState();
        const clientId = this.playerState.clientPlayer()?.id;

        if (!combat || !clientId) {
            return false;
        }

        return combat.attackerId === clientId || combat.defenderId === clientId;
    });

    handleCombatStarted(payload: ActiveCombatPayload): void {
        this.activeCombatState.set(payload);

        const attacker = this.playerState.players().find((player) => player.id === payload.attackerId);
        const defender = this.playerState.players().find((player) => player.id === payload.defenderId);

        this.combatStartHp.clear();

        if (attacker) {
            this.combatStartHp.set(attacker.id, attacker.hp ?? 0);
        }

        if (defender) {
            this.combatStartHp.set(defender.id, defender.hp ?? 0);
        }

        this.turnService.pauseForCombat(payload.roundTimeSeconds, this.isClientInActiveCombat());
    }

    handleCombatRound(payload: CombatRoundDetails): void {
        this.combatRoundState.set(payload);

        const attacker = this.playerState.players().find((player) => player.id === payload.attacker.playerId);
        const defender = this.playerState.players().find((player) => player.id === payload.defender.playerId);

        if (attacker) {
            this.playerState.updatePlayer(attacker.id, {
                hp: Math.max(0, (attacker.hp ?? 0) - (payload.attacker.damageTaken ?? 0)),
            });
        }

        if (defender) {
            this.playerState.updatePlayer(defender.id, {
                hp: Math.max(0, (defender.hp ?? 0) - (payload.defender.damageTaken ?? 0)),
            });
        }
    }

    clearCombatRound(): void {
        this.combatRoundState.set(null);
    }

    handleBattleWon(payload: BattleWonPayload): void {
        const clientId = this.playerState.clientPlayer()?.id;
        const isParticipant = clientId === payload.winnerId || clientId === payload.loserId;
        const wasClientInCombat = this.isClientInActiveCombat();

        if (!isParticipant) {
            this.combatRoundState.set(null);
        }

        const loser = this.playerState.players().find((player) => player.id === payload.loserId);
        const winner = this.playerState.players().find((player) => player.id === payload.winnerId);

        if (!loser || !winner) {
            this.combatRoundState.set(null);
            this.activeCombatState.set(null);
            this.combatStartHp.clear();
            this.turnService.stopCombatTimerOnly();
            return;
        }

        this.applyBattleOutcomeUpdates(payload, winner, loser);
        this.resumeClientAfterCombatIfNeeded(payload, winner, loser, wasClientInCombat);
    }

    clear(): void {
        this.combatRoundState.set(null);
        this.activeCombatState.set(null);
        this.combatStartHp.clear();
    }

    private applyBattleOutcomeUpdates(payload: BattleWonPayload, winner: Player, loser: Player): void {
        const winnerStartHp = this.combatStartHp.get(winner.id) ?? winner.hp ?? 0;
        const loserStartHp = this.combatStartHp.get(loser.id) ?? loser.hp ?? 0;

        const winnerLifeLost = Math.max(0, winnerStartHp - (payload.winnerHp ?? winner.hp ?? 0));
        const loserLifeLost = Math.max(0, loserStartHp);

        this.playerState.addVictoryPoint(winner.id);
        this.playerState.addDefeatPoint(loser.id);
        this.playerState.addCombatPoint(winner.id);
        this.playerState.addCombatPoint(loser.id);

        this.playerState.addTotalLifeLost(winner.id, winnerLifeLost);
        this.playerState.addTotalLifeLost(loser.id, loserLifeLost);
        this.playerState.addTotalDamageDealt(winner.id, loserLifeLost);
        this.playerState.addTotalDamageDealt(loser.id, winnerLifeLost);

        this.playerState.updatePlayer(winner.id, {
            hp: payload.winnerHp ?? winner.hp,
        });

        this.playerState.updatePlayer(loser.id, {
            position: payload.loserPos,
            hp: payload.loserHp ?? loser.hp,
        });

        this.combatStartHp.delete(winner.id);
        this.combatStartHp.delete(loser.id);
    }

    private resumeClientAfterCombatIfNeeded(
        payload: BattleWonPayload,
        winner: Player,
        loser: Player,
        wasClientInCombat: boolean,
    ): void {
        const shouldResumePausedTurnForEveryone = payload.remainingTurnSeconds !== undefined;

        if (shouldResumePausedTurnForEveryone) {
            this.turnService.resumeAfterCombat(payload.remainingTurnSeconds);
        } else if (wasClientInCombat) {
            this.turnService.stopCombatTimerOnly();
        }

        if (this.playerState.isClientPlayer(loser.id) && this.turnService.isClientPlayerTurn()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
            this.activeCombatState.set(null);
            return;
        }

        if (this.playerState.isClientPlayer(winner.id) && this.turnService.isClientPlayerTurn()) {
            if (!this.turnService.canPlayerStillDoAction()) {
                this.socketService.send(GatewayEvents.EndTurnEarly);
            } else {
                this.turnService.actionTile.set(movableTiles(this.mapService.getTileMap(), winner, this.playerState.getPlayers()));
            }
        }

        this.combatRoundState.set(null);
        this.activeCombatState.set(null);
    }
}
