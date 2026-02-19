import { computed, Injectable, signal } from '@angular/core';
import { Game } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    readonly players = signal<Player[]>([]);
    readonly clientPlayer = computed(() =>
        this.players().find(p => p.id === this.clientPlauerId) || null,
    );
    readonly game = signal<Game | null>(null);
    private clientPlauerId = '1';

    setGame(game: Game): void {
        this.game.set(game);
    }

    addPlayer(player: Player): void {
        this.players.update(players => [...players, player]);
    }

    setClientPlayer(player: Player): void {
        this.addPlayer(player);
        this.clientPlauerId = player.id;
    }

    updatePlayer(playerId: string, updates: Partial<Player>): void {
        this.players.update(players =>
            players.map(p =>
                p.id === playerId ? { ...p, ...updates } : p,
            ),
        );
    }
}
