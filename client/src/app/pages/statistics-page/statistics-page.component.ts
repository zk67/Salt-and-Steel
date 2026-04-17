import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { JournalDeJeuComponent } from '@app/components/journal-de-jeu/journal-de-jeu.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameSessionService } from '@app/services/game/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { GameMode } from '@common/enums/map.enums';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { PERCENTAGE, TIME_CONVERSION, STATISTICS_PAGE_REFRESH_FLAG } from '@common/types/menu-page.constants';

@Component({
    selector: 'app-statistics-page',
    templateUrl: './statistics-page.component.html',
    styleUrls: ['./statistics-page.component.scss'],
    imports: [RouterLink, ChatComponent, JournalDeJeuComponent],
})

export class StatisticsPageComponent implements OnInit, OnDestroy {
    playerColumn = PlayerColumn;
    messages: ChatMessage[] = [];

    currentPlayerName: string = '';
    currentPlayerId: string = '';

    players: Player[] = [];
    sortedPlayers: Player[] = [];
    sortColumn: PlayerColumn = PlayerColumn.Victory;
    sortDirection: 'asc' | 'desc' = 'desc';

    constructor(
        private router: Router,
        private gameService: GameService,
        private socketService: SocketClientService,
        private gameSessionService: GameSessionService,
    ) {}

    ngOnInit(): void {
        const wasRefreshing = sessionStorage.getItem(STATISTICS_PAGE_REFRESH_FLAG);
        if (wasRefreshing) {
            sessionStorage.removeItem(STATISTICS_PAGE_REFRESH_FLAG);
            this.router.navigate([APP_ROUTES.home]);
            return;
        }

        this.messages = this.gameService.getChatMessages();
        this.socketService.on(GatewayEvents.Message, this.addMessage);
        const currentPlayer = this.gameService.clientPlayer();
        if (currentPlayer) {
            this.currentPlayerName = currentPlayer.name;
            this.currentPlayerId = currentPlayer.id;
        }
        this.players = this.gameService.getPlayers();
        this.sortPlayers();
    }

    ngOnDestroy(): void {
        this.socketService.off(GatewayEvents.Message, this.addMessage);
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        sessionStorage.setItem(STATISTICS_PAGE_REFRESH_FLAG, '1');
        this.router.navigate([APP_ROUTES.home]);
    }

    sortPlayers(): void {
        this.sortedPlayers = [...this.players].sort((aPlayer, bPlayer) => {
            let aValue: string | number = '';
            let bValue: string | number = '';
            switch (this.sortColumn) {
                case PlayerColumn.Name:
                    aValue = aPlayer.name.toLowerCase();
                    bValue = bPlayer.name.toLowerCase();
                    break;
                case PlayerColumn.Combat:
                    aValue = aPlayer.stats.combatPoints;
                    bValue = bPlayer.stats.combatPoints;
                    break;
                case PlayerColumn.Victory:
                    aValue = aPlayer.stats.victoryPoints;
                    bValue = bPlayer.stats.victoryPoints;
                    break;
                case PlayerColumn.Defeat:
                    aValue = aPlayer.stats.defeatPoints;
                    bValue = bPlayer.stats.defeatPoints;
                    break;
                case PlayerColumn.TotalLifeLost:
                    aValue = aPlayer.stats.totalLifeLost;
                    bValue = bPlayer.stats.totalLifeLost;
                    break;
                case PlayerColumn.TotalDamageDealt:
                    aValue = aPlayer.stats.totalDamageDealt;
                    bValue = bPlayer.stats.totalDamageDealt;
                    break;
                case PlayerColumn.PercentageOfTileVisited:
                    aValue = aPlayer.stats.percentageOfTileVisited;
                    bValue = bPlayer.stats.percentageOfTileVisited;
                    break;
                default:
                    aValue = '';
                    bValue = '';
            }
            if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    setSort(column: PlayerColumn): void {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.sortPlayers();
    }

    private addMessage = (msg: ChatMessage) => {
        this.messages = [...this.messages, msg];
        this.gameService.setChatMessages(this.messages);
    };

    sendMessage(content: string): void {
        this.socketService.sendMessage(content);
    }

    get totalTurns(): number {
        return this.gameService.getTotalTurns();
    }

    get manipulatedDoorsPercentage(): number {
        const totalDoors = this.gameService.getTotalDoors();
        const manipulated = this.gameService.getManipulatedDoors().length;
        if (!this.hasDoors) return 0;
        return Math.round((manipulated / totalDoors) * PERCENTAGE);
    }

    get hasDoors(): boolean {
        const totalDoors = this.gameService.getTotalDoors();
        return totalDoors > 0;
    }

    get usedShrinesPercentage(): number {
        const totalShrines = this.gameService.getTotalShrines();
        const used = this.gameService.getUsedShrines().length;
        if (!this.hasShrines) return 0;
        return Math.round((used / totalShrines) * PERCENTAGE);
    }

    get hasShrines(): boolean {
        const totalShrines = this.gameService.getTotalShrines();
        return totalShrines > 0;
    }

    get gameDurationMMSS(): string {
        const seconds = this.gameSessionService.getGameTimer();
        if (seconds == null) return '--:--';
        const minutes = Math.floor(seconds / TIME_CONVERSION).toString().padStart(2, '0');
        const secondsLeft = Math.floor(seconds % TIME_CONVERSION).toString().padStart(2, '0');
        return `${minutes}:${secondsLeft}`;
    }

    get globalVisitedTilesPercentage(): number {
        return this.gameService.getGlobalVisitedTilesPercentage();
    }

    get flagHolderCount(): number {
        return this.gameService.getFlagHolderCount();
    }

    get hasFlag(): boolean {
        const mode = this.gameService.getGameMode();
        return mode === GameMode.CTF;
    }
}

export enum PlayerColumn {
    Name,
    Combat,
    Victory,
    Defeat,
    TotalLifeLost,
    TotalDamageDealt,
    PercentageOfTileVisited,
}
