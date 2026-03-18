import { computed, Injectable, signal } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { canMoveToTile, getActionableTiles, getNeighborPositions, isValidTile, movableTiles } from '@common/utils/map.utils';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { BattleWonPayload, Game, GameInfoPayload, NewTurnPayload, TurnPhase } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { GatewayEvents } from '@common/types/gateway.events';
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
        this.socketService.on(GatewayEvents.RemovePlayer, ({ playerId }: { playerId: string }) => {
            if (!this.isGameStarted) {
                this.removePlayer(playerId);
            } else {
                this.players.update(players => players.map(p => p.id === playerId ? { ...p, hasAbandoned: true } : p));
            }
        });

        this.socketService.on<GameInfoPayload>(GatewayEvents.GameStartInfo, this.handleStartGame.bind(this));
        this.socketService.on<BattleWonPayload>(GatewayEvents.HandleBattleWon, this.handleBattleWon.bind(this));
        this.socketService.on<NewTurnPayload>(GatewayEvents.NewTurn, this.handleNewTurn.bind(this));
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

            if(!this.canPlayerStillDoAction()) {
                this.socketService.send(GatewayEvents.EndTurnEarly);
            } else {
                if (this.actionMode) {
                    this.actionTile.set(getActionableTiles(tiles, player, this.getPlayers()));
                } else {
                    this.actionTile.set(movableTiles(tiles, player, this.getPlayers()));
                }
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
                this.updatePlayer(p.id, { position: p.position });
                alert(`Player ${p.name} has joined the game!`);
            } else {
                this.updatePlayer(p.id, { position: p.position });
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
        this.updatePlayer(loser.id, { position: payload.loserPos });

        if(this.clientPlayerId === winner.id && this.isClientPlayerTurn()) {
            if(!this.canPlayerStillDoAction()) {
                this.socketService.send(GatewayEvents.EndTurnEarly);
            } else {
                this.actionTile.set(movableTiles(this.mapService.getTileMap(), winner, this.getPlayers()));
            }
        }
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

    clearGameService(): void {
        this.players.set([]);
        this.activePlayerId.set(null);

        if (this.selectedJoinRoomId) {
            this.socketService.leaveRoom(this.selectedJoinRoomId);
            this.clearSelectedJoinRoomId();
        }

        this.clearSelectedHostGame();
        this.isGameStarted = false;
        this.clientPlayerId = '';
        this.actionMode = false;
        this.isDebugMode.set(false);
        this.hostId.set(null);
        this.actionTile.set([]);
        this.mapService.clearMapService();
    }

    private handleNewTurn(newTurn: NewTurnPayload) {
        const player = this.clientPlayer();
        if (!player) return;

        if (newTurn.phase === TurnPhase.WaitTurn) {
            this.isWaitTurn.set(true);
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_WAIT_TURN);
            this.setActivePlayer(newTurn.playerId);
            this.actionTile.set([]);

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
                if(!this.canPlayerStillDoAction()) {
                    this.socketService.send(GatewayEvents.EndTurnEarly);
                } else {
                    this.actionTile.set(movableTiles(this.mapService.getTileMap(), player, this.getPlayers()));
                }
            }
        }
    }

    canPlayerStillDoAction(): boolean {
        const player = this.clientPlayer();
        if (!player) return false;

        const possibleActionTiles = getActionableTiles(this.mapService.getTileMap(), player, this.getPlayers());
        const tiles = this.mapService.getTileMap();

        for (const possiblePosition of getNeighborPositions(player.position)) {
            if (!isValidTile(tiles, possiblePosition)){
                continue;
            }

            if (player.actionsLeft > 0 && possibleActionTiles[possiblePosition.y][possiblePosition.x]) {
                return true;
            }

            if(canMoveToTile(tiles, this.getPlayers(), { ...player.position, movementPoints: player.movementPoints }, possiblePosition) !== null) {
                return true;
            }
        }

        return false;
    }
}
