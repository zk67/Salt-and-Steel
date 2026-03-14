import { computed, Injectable, signal } from '@angular/core';
import { SocketClientService } from '@app/services/socket-client.service';
import { getActionableTiles, movableTiles } from '@app/utils/game-utils';
import { BattleWonPayload, GameInfoPayload } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';
import { MapService } from './map/map.service';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    readonly players = signal<Player[]>([]);
    readonly actionTile = signal<boolean[][]>([]);
    readonly activePlayer = computed(() => this.players().find(p => p.id === this.activePlayerId()) ?? null);
    private activePlayerId = signal<string | null>(null);
    private isGameStarted = false;

    readonly clientPlayer = computed(() =>
        this.players().find(p => p.id === this.clientPlayerId) || null,
    );

    readonly victoryLeaderboard = computed(() =>
        this.players().map(p => ({ playerName: p.name, victoryPoints: p.victoryPoints || 0 })),
    );

    readonly isDebugMode = signal<boolean>(false);
    readonly hostId = signal<string | null>(null);
    private actionMode: boolean = false;
    private clientPlayerId: string = '';

    constructor(private mapService: MapService, private socketService: SocketClientService) {
        this.socketService.on('removePlayer', ({ playerId }: { playerId: string }) => {
            if (!this.isGameStarted) {
                this.removePlayer(playerId);
            } else {
                this.players.update(players => players.map(p => p.id === playerId ? { ...p, isSurrendered: true } : p));
            }
        });

        this.socketService.on<GameInfoPayload>('gameStartInfo', this.handleStartGame.bind(this));
        this.socketService.on<BattleWonPayload>('handleBattleWon', this.handleBattleWon.bind(this));
    }

    setHostId(hostId: string): void {
        this.hostId.set(hostId);
    }

    addPlayer(player: Player): void {
        this.players.update(players => [...players, player]);
    }

    removePlayer(playerId: string): void {
        this.players.update(players => players.filter(p => p.id !== playerId));
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

        if (player && tiles.length > 0) {
            this.actionMode = this.actionMode ? false : true;

            if (this.actionMode) {
                this.actionTile.set(getActionableTiles(tiles, player, this.getPlayers()));
            } else {
                this.actionTile.set(movableTiles(tiles, player, this.getPlayers()));
            }
        }
    }

    setActivePlayer(id: string): void {
        this.activePlayerId.set(id);
    }

    setDebugMode(debugMode: boolean): void {
        this.isDebugMode.set(debugMode);
    }

    private handleStartGame(payload: GameInfoPayload): void {
        payload.players.forEach(p => {
            if (p.id !== this.clientPlayer()?.id) {
                this.addPlayer(p);
                alert(`Player ${p.name} has joined the game!`);
            }
        });

        this.mapService.loadFromDB(payload.game);
    }

    private handleBattleWon(payload: BattleWonPayload): void {
        const loser = this.players().find(p => p.id === payload.loserId);
        const winner = this.players().find(p => p.id === payload.winnerId);
        if (!loser || !winner) return;

        alert(`Player ${winner.name} has won the battle against ${loser.name}!`);
        this.addVictoryPoint(winner.id);
        this.updatePlayer(loser.id, { x: payload.loserPos.x, y: payload.loserPos.y });
    }
}
