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
        this.turnService.pauseForCombat(payload.roundTimeSeconds, this.isClientInActiveCombat());
    }

    handleCombatRound(payload: CombatRoundDetails): void {
        this.combatRoundState.set(payload);
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
            return;
        }

        this.applyBattleOutcomeUpdates(payload, winner, loser);
        this.resumeClientAfterCombatIfNeeded(payload, winner, loser, wasClientInCombat);
    }

    clear(): void {
        this.combatRoundState.set(null);
        this.activeCombatState.set(null);
    }

    private applyBattleOutcomeUpdates(payload: BattleWonPayload, winner: Player, loser: Player): void {
        this.playerState.addVictoryPoint(winner.id);

        this.playerState.updatePlayer(winner.id, {
            hp: payload.winnerHp ?? winner.hp,
        });

        this.playerState.updatePlayer(loser.id, {
            position: payload.loserPos,
            hp: payload.loserHp ?? loser.hp,
        });
    }

    private resumeClientAfterCombatIfNeeded(
        payload: BattleWonPayload,
        winner: Player,
        loser: Player,
        wasClientInCombat: boolean,
    ): void {
        if (wasClientInCombat) {
            const shouldResumeWinnerTurn = this.playerState.isClientPlayer(winner.id) && this.turnService.isClientPlayerTurn();
            this.turnService.resumeAfterCombat(shouldResumeWinnerTurn ? payload.remainingTurnSeconds : 0);
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

        this.activeCombatState.set(null);
    }
}
