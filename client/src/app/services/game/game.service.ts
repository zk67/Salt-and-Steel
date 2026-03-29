import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { ActiveCombatPayload, BattleWonPayload, CombatRoundDetails, Game, GameInfoPayload, NewTurnPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { movableTiles } from '@common/utils/map.utils';
import { GamePlayerStateService } from './game-player-state.service';
import { GameSessionService } from './game-session.service';
import { GameTurnService } from './game-turn.service';

const DELAY_BEFORE_NAVIGATE_HOME = 5000; // 5 seconds

@Injectable({
    providedIn: 'root',
})
export class GameService {
    private isGameStarted = false;
    private readonly combatRoundState = signal<CombatRoundDetails | null>(null);
    private readonly mapService = inject(MapService);
    private readonly socketService = inject(SocketClientService);
    private readonly router = inject(Router);
    private readonly popupService = inject(PopupService);
    private readonly playerState = inject(GamePlayerStateService);
    private readonly sessionService = inject(GameSessionService);
    private readonly turnService = inject(GameTurnService);
    private readonly activeCombatState = signal<ActiveCombatPayload | null>(null);

    readonly players = this.playerState.players;
    readonly activePlayer = this.playerState.activePlayer;
    readonly clientPlayer = this.playerState.clientPlayer;
    readonly victoryLeaderboard = this.playerState.victoryLeaderboard;
    readonly actionTile = this.turnService.actionTile;
    readonly isClientPlayerTurn = this.turnService.isClientPlayerTurn;
    readonly isWaitTurn = this.turnService.isWaitTurn;
    readonly isDebugMode = this.sessionService.isDebugMode;
    readonly hostId = this.sessionService.hostId;
    readonly currentCombatRound = computed(() => this.combatRoundState());
    readonly activeCombat = computed(() => this.activeCombatState());
    readonly isClientInActiveCombat = computed(() => {
        const combat = this.activeCombatState();
        const clientId = this.clientPlayer()?.id;

        if (!combat || !clientId) {
            return false;
        }

        return combat.attackerId === clientId || combat.defenderId === clientId;
    });

    constructor() {
        this.socketService.on<{ playerId: string }>(GatewayEvents.RemovePlayer, this.handlePlayerLeaving.bind(this));
        this.socketService.on<GameInfoPayload>(GatewayEvents.GameStartInfo, this.handleStartGame.bind(this));
        this.socketService.on<BattleWonPayload>(GatewayEvents.HandleBattleWon, this.handleBattleWon.bind(this));
        this.socketService.on<NewTurnPayload>(GatewayEvents.NewTurn, this.handleNewTurn.bind(this));
        this.socketService.on<CombatRoundDetails>(GatewayEvents.HandleCombatRound, this.handleCombatRound.bind(this));
        this.socketService.on<ActiveCombatPayload>(GatewayEvents.CombatStarted, this.handleCombatStarted.bind(this));
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

    private handleBattleWon(payload: BattleWonPayload): void {
        const clientId = this.clientPlayer()?.id;
        const isParticipant = clientId === payload.winnerId || clientId === payload.loserId;
        const wasClientInCombat = this.isClientInActiveCombat();

        if (!isParticipant) {
            this.combatRoundState.set(null);
        }

        const loser = this.players().find((p) => p.id === payload.loserId);
        const winner = this.players().find((p) => p.id === payload.winnerId);

        if (!loser || !winner) {
            return;
        }

        this.applyBattleOutcomeUpdates(payload, winner, loser);
        this.resumeClientAfterCombatIfNeeded(payload, winner, loser, wasClientInCombat);
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
        this.mapService.clearMapService();
        this.combatRoundState.set(null);
        this.activeCombatState.set(null);
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

    private handleCombatRound(payload: CombatRoundDetails): void {
        this.combatRoundState.set(payload);
    }

    clearCombatRound(): void {
        this.combatRoundState.set(null);
    }

    private handleCombatStarted(payload: ActiveCombatPayload): void {
        this.activeCombatState.set(payload);
        this.turnService.pauseForCombat(payload.roundTimeSeconds, this.isClientInActiveCombat());
    }

    private applyBattleOutcomeUpdates(payload: BattleWonPayload, winner: Player, loser: Player): void {
        this.addVictoryPoint(winner.id);

        this.updatePlayer(winner.id, {
            hp: payload.winnerHp ?? winner.hp,
        });

        this.updatePlayer(loser.id, {
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
            const shouldResumeWinnerTurn = this.playerState.isClientPlayer(winner.id) && this.isClientPlayerTurn();
            this.turnService.resumeAfterCombat(shouldResumeWinnerTurn ? payload.remainingTurnSeconds : 0);
        }

        if (this.playerState.isClientPlayer(loser.id) && this.isClientPlayerTurn()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
            this.activeCombatState.set(null);
            return;
        }

        if (this.playerState.isClientPlayer(winner.id) && this.isClientPlayerTurn()) {
            if (!this.canPlayerStillDoAction()) {
                this.socketService.send(GatewayEvents.EndTurnEarly);
            } else {
                this.actionTile.set(movableTiles(this.mapService.getTileMap(), winner, this.getPlayers()));
            }
        }

        this.activeCombatState.set(null);
    }
}
