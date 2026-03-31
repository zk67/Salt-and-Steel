import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { Game, GameInfoPayload, NewTurnPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GameCombatService } from './game-combat.service';
import { GamePlayerStateService } from './game-player-state.service';
import { GameSessionService } from './game-session.service';
import { GameSocketEventsService } from './game-socket-events.service';
import { GameTurnService } from './game-turn.service';

const DELAY_BEFORE_NAVIGATE_HOME = 5000; // 5 seconds

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

    constructor() {
        this.socketEventsService.registerHandlers({
            onPlayerRemoved: this.handlePlayerLeaving.bind(this),
            onGameStarted: this.handleStartGame.bind(this),
            onBattleWon: this.combatService.handleBattleWon.bind(this.combatService),
            onNewTurn: this.handleNewTurn.bind(this),
            onCombatRound: this.combatService.handleCombatRound.bind(this.combatService),
            onCombatStarted: this.combatService.handleCombatStarted.bind(this.combatService),
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

        const sorted = [...payload.players].sort((a, b) => a.turnOrder - b.turnOrder);
        this.playerState.setPlayers(sorted);

        this.mapService.loadFromDB(payload.game);
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
        } else {

            this.updatePlayer(payload.playerId, { hasAbandoned: true });

            if (this.players().filter(p => !p.hasAbandoned).length <= 1) {
                this.popupService.open(`Le joueur ${this.clientPlayer()?.name} a quitté la partie. `
                    + `Vous êtes le dernier joueur restant. Vous serez bientôt redirigé vers le menu principal.`);

                setTimeout(() => {
                    this.clearGameService();
                    this.popupService.close();
                    this.router.navigate([APP_ROUTES.home]);
                }, DELAY_BEFORE_NAVIGATE_HOME);
            }
        }
    }

    private handleNewTurn(newTurn: NewTurnPayload) {
        this.turnService.handleNewTurn(newTurn);
    }

    canPlayerStillDoAction(): boolean {
        return this.turnService.canPlayerStillDoAction();
    }

    clearCombatRound(): void {
        this.combatService.clearCombatRound();
    }
}
