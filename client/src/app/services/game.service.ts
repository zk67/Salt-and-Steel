import { computed, Injectable, signal } from '@angular/core';
import { SocketClientService } from '@app/services/socket-client.service';
import { getActionableTiles, movableTiles } from '@app/utils/game-utils';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { BattleWonPayload, Game, GameInfoPayload, NewTurnPayload, TurnPhase } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { MapService } from './map/map.service';
import { TimeService } from './time.service';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    readonly players = signal<Player[]>([]);
    readonly actionTile = signal<boolean[][]>([]);
    readonly isClientPlayerTurn = signal<boolean>(false);
    readonly isWaitTurn = signal<boolean>(false);
    private selectedJoinRoomId: string | null = null;
    private selectedHostGame: Game | null = null;

    readonly activePlayer = computed(() => this.players().find((p) => p.id === this.activePlayerId()) ?? null);
    private activePlayerId = signal<string | null>(null);

    private isGameStarted = false;


    readonly clientPlayer = computed(() =>
        this.players().find((p) => p.id === this.clientPlayerId) || null,
    );

    readonly victoryLeaderboard = computed(() =>
        this.players().map((p) => ({ playerName: p.name, victoryPoints: p.victoryPoints || 0 })),
    );

    readonly isDebugMode = signal<boolean>(false);
    readonly hostId = signal<string | null>(null);
    private actionMode: boolean = false;
    private clientPlayerId: string = '';

    private chatMessages: ChatMessage[] = [];

    constructor(private mapService: MapService, private socketService: SocketClientService, private timeService: TimeService) {
        this.socketService.on('removePlayer', ({ playerId }: { playerId: string }) => {
            if (!this.isGameStarted) {
                this.removePlayer(playerId);
            } else {
                this.players.update(players => players.map(p => p.id === playerId ? { ...p, hasAbandoned: true } : p));
            }
        });

        this.socketService.on<GameInfoPayload>('gameStartInfo', this.handleStartGame.bind(this));
        this.socketService.on<BattleWonPayload>('handleBattleWon', this.handleBattleWon.bind(this));
        this.socketService.on<NewTurnPayload>('newTurn', this.handleNewTurn.bind(this));
    }

    setChatMessages(messages: ChatMessage[]): void {
        this.chatMessages = [...messages];
    }

    getChatMessages(): ChatMessage[] {
        return [...this.chatMessages];
    }

    clearChatMessages(): void {
        this.chatMessages = [];
    }

    setHostId(hostId: string): void {
        this.hostId.set(hostId);
    }

    addPlayer(player: Player): void {
        this.players.update((players) => [...players, player]);
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
        this.updatePlayer(playerId, {
            victoryPoints: (this.players().find((p) => p.id === playerId)?.victoryPoints || 0) + 1,
        });
    }

    setClientPlayer(player: Player): void {
        this.addPlayer(player);
        this.clientPlayerId = player.id;
    }

    updatePlayer(playerId: string, updates: Partial<Player>): void {
        this.players.update((players) =>
            players.map((p) =>
                p.id === playerId ? { ...p, ...updates } : p,
            ),
        );
    }

    changeActionMode(): void {
        const player = this.clientPlayer();
        const tiles = this.mapService.getTileMap();

        if (player && tiles.length > 0) {
            this.actionMode = !this.actionMode;

            if (this.actionMode) {
                this.actionTile.set(getActionableTiles(tiles, player, this.getPlayers()));
            } else {
                this.actionTile.set(movableTiles(tiles, player, this.getPlayers()));
            }
        }
    }

    setSelectedJoinRoomId(roomId: string): void {
        this.selectedJoinRoomId = roomId;
    }

    getSelectedJoinRoomId(): string | null {
        return this.selectedJoinRoomId;
    }

    clearSelectedJoinRoomId(): void {
        this.selectedJoinRoomId = null;
    }

    setActivePlayer(id: string): void {
        this.activePlayerId.set(id);
    }

    toggleDebugMode(): void {
        this.isDebugMode.update((v) => !v);
    }

    setDebugMode(debugMode: boolean): void {
        this.isDebugMode.set(debugMode);
    }

    private handleStartGame(payload: GameInfoPayload): void {
        this.isGameStarted = true;
        payload.players.forEach(p => {
            if (p.id !== this.clientPlayer()?.id) {
                this.addPlayer(p);
                this.updatePlayer(p.id, { x: p.x, y: p.y });
                alert(`Player ${p.name} has joined the game!`);
            } else {
                this.updatePlayer(p.id, { x: p.x, y: p.y });
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

    setSelectedHostGame(game: Game): void {
        this.selectedHostGame = game;
    }

    getSelectedHostGame(): Game | null {
        return this.selectedHostGame;
    }

    clearSelectedHostGame(): void {
        this.selectedHostGame = null;
    }

    private handleNewTurn(newTurn: NewTurnPayload) {
        const player = this.clientPlayer();
        if (!player) return;

        if (newTurn.phase === TurnPhase.WaitTurn) {
            this.isWaitTurn.set(true);
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_WAIT_TURN);
            this.setActivePlayer(newTurn.playerId);

            if (newTurn.playerId === player.id) {
                this.isClientPlayerTurn.set(true);
                player.movementPoints = player.speed ?? 0;
                player.actionsLeft = 1;
            } else {
                this.isClientPlayerTurn.set(false);
                player.movementPoints = 0;
                player.actionsLeft = 0;
            }

            this.updatePlayer(player.id, player);
        } else {
            this.isWaitTurn.set(false);
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_TURN);

            if (player.id === newTurn.playerId) {
                this.actionTile.set(movableTiles(this.mapService.getTileMap(), player, this.getPlayers()));
            }
        }
    }
}
