import { computed, inject, Injectable, signal } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ActiveCombatPayload, BattleWonPayload, CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { movableTiles } from '@common/utils/map.utils';
import { GamePlayerStateService } from './game-player-state.service';
import { GameTurnService } from './game-turn.service';

const COMBAT_RESULT_NOTIFICATION_DURATION_MS = 3000;

@Injectable({
    providedIn: 'root',
})
export class GameCombatService {
    private combatStartHp = new Map<string, number>();
    private readonly combatRoundState = signal<CombatRoundDetails | null>(null);
    private readonly activeCombatState = signal<ActiveCombatPayload | null>(null);
    private readonly mapService = inject(MapService);
    private readonly popupService = inject(PopupService);
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

        if (attacker && attacker.actionsLeft > 0) {
            this.playerState.updatePlayer(attacker.id, { actionsLeft: attacker.actionsLeft - 1 });
        }

        this.combatStartHp.clear();

        if (attacker) {
            this.combatStartHp.set(attacker.id, attacker.hp ?? 0);
        }

        if (defender) {
            this.combatStartHp.set(defender.id, defender.hp ?? 0);
        }

        this.turnService.pauseForCombat(payload.roundTimeSeconds);
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

        this.updateCombatStatsIfBothPresent(attacker, defender, payload);
    }

    private updateCombatStatsIfBothPresent(attacker: Player | undefined, defender: Player | undefined, payload: CombatRoundDetails): void {
        if (attacker && defender) {
            if (payload.attacker.damageTaken > attacker.hp) {
                this.playerState.addTotalLifeLost(attacker.id, attacker.hp ?? 0);
                this.playerState.addTotalDamageDealt(defender.id, attacker.hp ?? 0);
            } else {
                this.playerState.addTotalLifeLost(attacker.id, payload.attacker.damageTaken ?? 0);
                this.playerState.addTotalDamageDealt(defender.id, payload.defender.damageDealt ?? 0);
            }

            if (payload.defender.damageTaken > defender.hp) {
                this.playerState.addTotalLifeLost(defender.id, defender.hp ?? 0);
                this.playerState.addTotalDamageDealt(attacker.id, defender.hp ?? 0);
            } else {
                this.playerState.addTotalLifeLost(defender.id, payload.defender.damageTaken ?? 0);
                this.playerState.addTotalDamageDealt(attacker.id, payload.attacker.damageDealt ?? 0);
            }
        }
    }

    clearCombatRound(): void {
        this.combatRoundState.set(null);
    }

    handleBattleWon(payload: BattleWonPayload): void {
        const clientId = this.playerState.clientPlayer()?.id;
        const wasClientInCombat = this.isClientInActiveCombat();

        if (payload.doubleKo) {
            if (wasClientInCombat) {
                this.popupService.openNotification('Double KO ! Vous réapparaissez après le combat.', COMBAT_RESULT_NOTIFICATION_DURATION_MS);
            }
            this.handleDoubleKoBattle(payload, wasClientInCombat);
            return;
        }

        const isParticipant = clientId === payload.winnerId || clientId === payload.loserId;

        if (!isParticipant) {
            this.combatRoundState.set(null);
        }

        const loser = this.playerState.players().find((player) => player.id === payload.loserId);
        const winner = this.playerState.players().find((player) => player.id === payload.winnerId);

        if (!loser || !winner) {
            this.combatRoundState.set(null);
            this.activeCombatState.set(null);
            this.combatStartHp.clear();
            if (wasClientInCombat) {
                this.turnService.stopCombatTimerOnly();
            }
            return;
        }

        if (isParticipant) {
            this.showBattleResultNotification(winner, loser);
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
        this.playerState.addVictoryPoint(winner.id);
        this.playerState.addDefeatPoint(loser.id);
        this.playerState.addCombatPoint(winner.id);
        this.playerState.addCombatPoint(loser.id);

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

    private handleDoubleKoBattle(payload: BattleWonPayload, wasClientInCombat: boolean): void {
        if (!payload.attackerRespawn || !payload.defenderRespawn) {
            this.combatRoundState.set(null);
            this.activeCombatState.set(null);
            this.combatStartHp.clear();

            if (wasClientInCombat) {
                this.turnService.stopCombatTimerOnly();
            }
            return;
        }

        this.applyDoubleKoOutcomeUpdates(payload);

        if (wasClientInCombat) {
            this.turnService.stopCombatTimerOnly();
        }

        this.combatRoundState.set(null);
        this.activeCombatState.set(null);
    }

    private applyDoubleKoOutcomeUpdates(payload: BattleWonPayload): void {
        const attackerRespawn = payload.attackerRespawn;
        const defenderRespawn = payload.defenderRespawn;

        if (!attackerRespawn || !defenderRespawn) {
            return;
        }

        const attacker = this.playerState.players().find((player) => player.id === attackerRespawn.playerId);
        const defender = this.playerState.players().find((player) => player.id === defenderRespawn.playerId);

        if (!attacker || !defender) {
            this.combatStartHp.delete(attackerRespawn.playerId);
            this.combatStartHp.delete(defenderRespawn.playerId);
            return;
        }

        this.playerState.addCombatPoint(attacker.id);
        this.playerState.addCombatPoint(defender.id);

        this.playerState.addDefeatPoint(attacker.id);
        this.playerState.addDefeatPoint(defender.id);

        this.playerState.updatePlayer(attacker.id, {
            position: attackerRespawn.position,
            hp: attackerRespawn.hp,
        });

        this.playerState.updatePlayer(defender.id, {
            position: defenderRespawn.position,
            hp: defenderRespawn.hp,
        });

        this.combatStartHp.delete(attacker.id);
        this.combatStartHp.delete(defender.id);
    }

    private showBattleResultNotification(winner: Player, loser: Player): void {
        const clientPlayer = this.playerState.clientPlayer();
        if (!clientPlayer) {
            return;
        }

        const message =
            clientPlayer.id === winner.id
                ? `Victoire ! Vous avez vaincu ${loser.name}.`
                : `Défaite. ${winner.name} vous a vaincu.`;

        this.popupService.openNotification(message, COMBAT_RESULT_NOTIFICATION_DURATION_MS);
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
            this.combatRoundState.set(null);
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
