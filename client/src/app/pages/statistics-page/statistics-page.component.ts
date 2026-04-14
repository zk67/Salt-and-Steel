import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { GameMode } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';

const PERCENTAGE = 100;
const TIME_CONVERSION = 60;

@Component({
    selector: 'app-statistics-page',
    templateUrl: './statistics-page.component.html',
    styleUrls: ['./statistics-page.component.scss'],
    imports: [RouterLink, ChatComponent],
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

    constructor(private gameService: GameService, private socketService: SocketClientService) {}

    ngOnInit(): void {
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

    sortPlayers(): void {
        this.sortedPlayers = [...this.players].sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';
            switch (this.sortColumn) {
                case PlayerColumn.Name:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case PlayerColumn.Combat:
                    aValue = a.stats.combatPoints;
                    bValue = b.stats.combatPoints;
                    break;
                case PlayerColumn.Victory:
                    aValue = a.stats.victoryPoints;
                    bValue = b.stats.victoryPoints;
                    break;
                case PlayerColumn.Defeat:
                    aValue = a.stats.defeatPoints;
                    bValue = b.stats.defeatPoints;
                    break;
                case PlayerColumn.TotalLifeLost:
                    aValue = a.stats.totalLifeLost;
                    bValue = b.stats.totalLifeLost;
                    break;
                case PlayerColumn.TotalDamageDealt:
                    aValue = a.stats.totalDamageDealt;
                    bValue = b.stats.totalDamageDealt;
                    break;
                case PlayerColumn.PercentageOfTileVisited:
                    aValue = a.stats.percentageOfTileVisited;
                    bValue = b.stats.percentageOfTileVisited;
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
        const seconds = this.gameService.getGameDurationSeconds();
        if (seconds == null) return '--:--';
        const mm = Math.floor(seconds / TIME_CONVERSION).toString().padStart(2, '0');
        const ss = Math.floor(seconds % TIME_CONVERSION).toString().padStart(2, '0');
        return `${mm}:${ss}`;
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