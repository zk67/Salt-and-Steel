import { computed, Injectable, signal } from '@angular/core';
import { Player } from '@common/interfaces/player.interface';

@Injectable({
    providedIn: 'root',
})
export class GamePlayerStateService {
    readonly players = signal<Player[]>([]);
    readonly activePlayerId = signal<string | null>(null);

    private clientPlayerId = '';

    readonly activePlayer = computed(() => this.players().find((player) => player.id === this.activePlayerId()) ?? null);
    readonly clientPlayer = computed(() => this.players().find((player) => player.id === this.clientPlayerId) ?? null);
    readonly victoryLeaderboard = computed(() =>
        this.players().map((player) => ({ playerName: player.name, victoryPoints: player.stats.victoryPoints || 0 })),
    );

    addPlayer(player: Player): void {
        this.players.update((players) => [...players, player]);
    }

    removePlayer(playerId: string): void {
        this.players.update((players) => players.filter((player) => player.id !== playerId));
    }

    getPlayers(): Player[] {
        return this.players();
    }

    setPlayers(players: Player[]): void {
        this.players.set(players);
    }

    setClientPlayer(player: Player): void {
        this.addPlayer(player);
        this.clientPlayerId = player.id;
    }

    isClientPlayer(playerId: string): boolean {
        return this.clientPlayerId === playerId;
    }

    updatePlayer(playerId: string, updates: Partial<Player>): void {
        this.players.update((players) => players.map((player) => (player.id === playerId ? { ...player, ...updates } : player)));
    }

    addVictoryPoint(playerId: string): void {
        const player = this.players().find((p) => p.id === playerId);
        if (!player) return;
        const newStats = {
            ...player.stats,
            victoryPoints: (player.stats?.victoryPoints || 0) + 1,
        };
        this.updatePlayer(playerId, { stats: newStats });
    }

    addDefeatPoint(playerId: string): void {
        const player = this.players().find((p) => p.id === playerId);
        if (!player) return;
        const newStats = {
            ...player.stats,
            defeatPoints: (player.stats?.defeatPoints || 0) + 1,
        };
        this.updatePlayer(playerId, { stats: newStats });
    }

    addCombatPoint(playerId: string): void {
        const player = this.players().find((p) => p.id === playerId);
        if (!player) return;
        const newStats = {
            ...player.stats,
            combatPoints: (player.stats?.combatPoints || 0) + 1,
        };
        this.updatePlayer(playerId, { stats: newStats });
    }

    addTotalLifeLost(playerId: string, lifeLost: number): void {
        const player = this.players().find((p) => p.id === playerId);
        if (!player) return;
        const newStats = {
            ...player.stats,
            totalLifeLost: (player.stats?.totalLifeLost || 0) + lifeLost,
        };
        this.updatePlayer(playerId, { stats: newStats });
    }

    addTotalDamageDealt(playerId: string, damageDealt: number): void {
        const player = this.players().find((p) => p.id === playerId);
        if (!player) return;
        const newStats = {
            ...player.stats,
            totalDamageDealt: (player.stats?.totalDamageDealt || 0) + damageDealt,
        };
        this.updatePlayer(playerId, { stats: newStats });
    }

    setActivePlayer(id: string): void {
        this.activePlayerId.set(id);
    }

    clear(): void {
        this.players.set([]);
        this.activePlayerId.set(null);
        this.clientPlayerId = '';
    }
}
