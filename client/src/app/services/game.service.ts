import { computed, Injectable, signal } from '@angular/core';
import { movableTiles, getActionableTiles } from '@app/utils/game-utils';
import { Player } from '@common/types/player.interface';
import { MapService } from './map/map.service';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    readonly players = signal<Player[]>([]);
    readonly actionTile = signal<boolean[][]>([]);
    readonly selectedJoinRoomId = signal<string | null>(null);
    readonly clientPlayer = computed(() =>
        this.players().find(p => p.id === this.clientPlayerId) || null,
    );
    readonly victoryLeaderboard = computed(() =>
        this.players().map(p => ({ playerName: p.name, victoryPoints: p.victoryPoints || 0 })),
    );

    private actionMode: boolean = false;
    private clientPlayerId: string = '';

    constructor(private mapService: MapService) {}

    addPlayer(player: Player): void {
        this.players.update(players => [...players, player]);
    }

    getPlayers(): Player[] {
        return this.players();
    }

    getActionMode(): boolean {
        return this.actionMode;
    }

    addVictoryPoint(playerId: string): void {
        this.updatePlayer(playerId, { victoryPoints: (this.players().find(p => p.id === playerId)?.victoryPoints || 0) + 1 });
    }

    setClientPlayer(player: Player): void {
        this.addPlayer(player);
        this.clientPlayerId = player.id;
    }

    updatePlayer(playerId: string, updates: Partial<Player>): void {
        this.players.update(players =>
            players.map(p =>
                p.id === playerId ? { ...p, ...updates } : p,
            ),
        );
    }

    changeActionMode(): void {
        const player = this.clientPlayer();
        const tiles = this.mapService.getTileMap();

        if(player && tiles.length > 0) {
            this.actionMode = this.actionMode ? false : true;

            if (this.actionMode) {
                this.actionTile.set(getActionableTiles(tiles, player, this.getPlayers()));
            }else{
                this.actionTile.set(movableTiles(tiles, player, this.getPlayers()));
            }
        }
    }

    setSelectedJoinRoomId(roomId: string): void {
        this.selectedJoinRoomId.set(roomId);
    }

    getSelectedJoinRoomId(): string | null {
        return this.selectedJoinRoomId();
    }

    clearSelectedJoinRoomId(): void {
        this.selectedJoinRoomId.set(null);
    }
}
