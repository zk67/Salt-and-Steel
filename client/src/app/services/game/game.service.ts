import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { Game, GameInfoPayload, NewTurnPayload } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { GameCombatService } from './game-combat.service';
import { GamePlayerStateService } from './game-player-state.service';
import { GameSessionService } from './game-session.service';
import { GameSocketEventsService } from './game-socket-events.service';
import { GameTurnService } from './game-turn.service';

const DELAY_BEFORE_NAVIGATE_HOME = 5000; // 5 seconds
const PERCENTAGE = 100;
const WALL = 3;

@Injectable({
    providedIn: 'root',
})
export class GameService {
    private isGameStarted = false;
    private readonly mapService = inject(MapService);
    private readonly socketService = inject(SocketClientService);
    private readonly router = inject(Router);
    private readonly popupService = inject(PopupService);
    private readonly combatService = inject(GameCombatService);
    private readonly playerState = inject(GamePlayerStateService);
    private readonly sessionService = inject(GameSessionService);
    private readonly socketEventsService = inject(GameSocketEventsService);
    private readonly turnService = inject(GameTurnService);

    readonly players = this.playerState.players;
    readonly activePlayer = this.playerState.activePlayer;
    readonly clientPlayer = this.playerState.clientPlayer;
    readonly victoryLeaderboard = this.playerState.victoryLeaderboard;
    readonly actionTile = this.turnService.actionTile;
    readonly isClientPlayerTurn = this.turnService.isClientPlayerTurn;
    readonly isWaitTurn = this.turnService.isWaitTurn;
    readonly isDebugMode = this.sessionService.isDebugMode;
    readonly hostId = this.sessionService.hostId;
    readonly currentCombatRound = this.combatService.currentCombatRound;
    readonly activeCombat = this.combatService.activeCombat;
    readonly isClientInActiveCombat = this.combatService.isClientInActiveCombat;
    readonly gameMode = this.mapService.getGameMode();

    constructor() {
        this.socketEventsService.registerHandlers({
            onPlayerRemoved: this.handlePlayerLeaving.bind(this),
            onGameStarted: this.handleStartGame.bind(this),
            onBattleWon: this.combatService.handleBattleWon.bind(this.combatService),
            onNewTurn: this.handleNewTurn.bind(this),
            onCombatRound: this.combatService.handleCombatRound.bind(this.combatService),
            onCombatStarted: this.combatService.handleCombatStarted.bind(this.combatService),
        });

        this.socketService.on<string>(GatewayEvents.ShrineBuffOff, (playerId) => {
            this.clearShrineBuffsIfExpired(playerId);
        });
    }

    setChatMessages(messages: ChatMessage[]): void {
        this.sessionService.setChatMessages(messages);
    }

    getChatMessages(): ChatMessage[] {
        return this.sessionService.getChatMessages();
    }

    clearChatMessages(): void {
        this.sessionService.clearChatMessages();
    }

    setHostId(hostId: string): void {
        this.sessionService.setHostId(hostId);
    }

    addPlayer(player: Player): void {
        this.playerState.addPlayer(player);
    }

    removePlayer(playerId: string): void {
        this.playerState.removePlayer(playerId);
    }

    getPlayers(): Player[] {
        return this.playerState.getPlayers();
    }

    getActionMode(): boolean {
        return this.turnService.getActionMode();
    }

    addVictoryPoint(playerId: string): void {
        this.playerState.addVictoryPoint(playerId);
    }

    setClientPlayer(player: Player): void {
        this.playerState.setClientPlayer(player);
    }

    updatePlayer(playerId: string, updates: Partial<Player>): void {
        this.playerState.updatePlayer(playerId, updates);
    }

    changeActionMode(): void {
        this.turnService.changeActionMode();
    }

    setSelectedJoinRoomId(roomId: string): void {
        this.sessionService.setSelectedJoinRoomId(roomId);
    }

    getSelectedJoinRoomId(): string | null {
        return this.sessionService.getSelectedJoinRoomId();
    }

    clearSelectedJoinRoomId(): void {
        this.sessionService.clearSelectedJoinRoomId();
    }

    setActivePlayer(id: string): void {
        this.playerState.setActivePlayer(id);
    }

    toggleDebugMode(): void {
        this.sessionService.toggleDebugMode();
    }

    setDebugMode(debugMode: boolean): void {
        this.sessionService.setDebugMode(debugMode);
    }

    private handleStartGame(payload: GameInfoPayload): void {
        this.isGameStarted = true;
        this.combatService.clear();

        const sorted = [...payload.players].sort((a, b) => a.turnOrder - b.turnOrder);
        this.playerState.setPlayers(sorted);
        const gameWithTurns = { ...payload.game, totalTurns: payload.totalTurns ?? 0 };
        this.mapService.loadFromDB(gameWithTurns);
    }

    setSelectedHostGame(game: Game): void {
        this.sessionService.setSelectedHostGame(game);
    }

    getSelectedHostGame(): Game | null {
        return this.sessionService.getSelectedHostGame();
    }

    clearSelectedHostGame(): void {
        this.sessionService.clearSelectedHostGame();
    }

    clearGameService(): void {
        const selectedJoinRoomId = this.sessionService.getSelectedJoinRoomId();
        if (selectedJoinRoomId) {
            this.socketService.leaveRoom(selectedJoinRoomId);
        }

        this.isGameStarted = false;
        this.playerState.clear();
        this.sessionService.clear();
        this.turnService.clear();
        this.combatService.clear();
        this.mapService.clearMapService();
    }

    private handlePlayerLeaving(payload: { playerId: string }): void {
        if (!this.isGameStarted) {
            this.removePlayer(payload.playerId);
            return;
        }

        this.updatePlayer(payload.playerId, { hasAbandoned: true });

        if (!this.activeCombat()) {
            this.turnService.refreshActionTiles();
        }

        if (this.mapService.getGameMode() === GameMode.Classic) {
            return;
        }

        const remainingPlayers = this.players().filter((player) => !player.hasAbandoned);
        const teams = new Set(remainingPlayers.map((player) => player.isRedTeam));

        if (teams.size === 1 && remainingPlayers.length > 0) {
            const isRedTeam = remainingPlayers[0].isRedTeam;
            const teamName = isRedTeam ? 'Rouge' : 'Bleu';

            this.popupService.open(`L'equipe ${teamName} est la derniere restante. Vous serez redirige.`);

            setTimeout(() => {
                this.clearGameService();
                this.popupService.close();
                this.router.navigate([APP_ROUTES.home]);
            }, DELAY_BEFORE_NAVIGATE_HOME);
        }
    }

    private handleNewTurn(newTurn: NewTurnPayload) {
        this.popupService.closeChoice();
        if (newTurn.totalTurns) {
            const game = this.mapService.getGameData();
            if (game) {
                (game as Game & { totalTurns?: number }).totalTurns = newTurn.totalTurns;
            }
        }
        this.turnService.handleNewTurn(newTurn);
    }

    private clearShrineBuffsIfExpired(playerId: string): void {
        const player = this.players().find(p => p.id === playerId);
        if (player?.shrineBuffs) {
            this.updatePlayer(playerId, {
                attack: player.attack - (player.shrineBuffs.bonusAmount),
                defense: player.defense - (player.shrineBuffs.bonusAmount),
                shrineBuffs: undefined,
            });
        }
    }

    canPlayerStillDoAction(): boolean {
        return this.turnService.canPlayerStillDoAction();
    }

    clearCombatRound(): void {
        this.combatService.clearCombatRound();
    }

    clearCombatState(): void {
        this.combatService.clear();
    }

    getTotalTurns(): number {
        const game = this.mapService.getGameData() as Game & { totalTurns?: number };
        return game && typeof game.totalTurns === 'number' ? game.totalTurns : 0;
    }

    getGameDurationSeconds(): number | null {
        return this.combatService.getGameDurationSeconds();
    }

    isSpecialTile(tile: { tileType: number; mapObject: number }): boolean {
        return (tile.tileType !== WALL || tile.mapObject === MapObjectType.SpawnPoint || tile.mapObject === MapObjectType.Flag);
    }

    getAllVisitedPositions(players: Player[]): Set<string> {
        return new Set(
            players.flatMap((player) => player.visitedTiles ?? []),
        );
    }

    countSpecialTiles(tiles: { tileType: number; mapObject: number }[][]): number {
        return tiles
            .flat()
            .filter((tile) => tile && this.isSpecialTile(tile))
            .length;
    }

    countVisitedSpecialTiles(visited: Set<string>, tiles: { tileType: number; mapObject: number }[][]): number {
        let count = 0;
        const sizeY = tiles.length;
        const sizeX = tiles[0].length;
        for (const posStr of visited) {
            const [x, y] = posStr.split(',').map(Number);
            if (y >= 0 && y < sizeY && x >= 0 && x < sizeX) {
                const tile = tiles[y][x];
                if (tile && this.isSpecialTile(tile)) {
                    count++;
                }
            }
        }
        return count;
    }

    getGlobalVisitedTilesPercentage(): number {
        const players = this.getPlayers();
        const tiles = this.mapService.getTileMap();
        if (!tiles.length || !players.length) return 0;
        const visited = this.getAllVisitedPositions(players);
        const totalTiles = this.countSpecialTiles(tiles);
        const visitedTiles = this.countVisitedSpecialTiles(visited, tiles);
        if (totalTiles === 0) return 0;
        return Math.round((visitedTiles / totalTiles) * PERCENTAGE);
    }

    getFlagHolderCount(): number {
        return this.playerState.getFlagHolderCount();
    }

    getTotalDoors(): number {
        return this.mapService.getTotalDoors();
    }

    getManipulatedDoors(): string[] {
        return this.mapService.getManipulatedDoors();
    }

    getTotalShrines(): number {
        return this.mapService.getTotalShrines();
    }

    getUsedShrines(): string[] {
        return this.mapService.getUsedShrines();
    }

    getGameMode(): string {
        return this.mapService.getGameMode();
    }
}
