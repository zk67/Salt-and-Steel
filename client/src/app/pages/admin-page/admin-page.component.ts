import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameCreatedComponent } from '@app/components/game-created/game-created.component';
import { PopupComponent } from '@app/components/popup';
import { APP_ROUTES } from '@app/const/routes-const';
import { PopupService } from '@app/services/popup.service';
import { SaveService } from '@app/services/save/save.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Game } from '@common/interfaces/game.interface';
import { FORBIDDEN } from '@common/types/game.constant';
import { GatewayEvents } from '@common/types/gateway.events';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, GameCreatedComponent, PopupComponent],
})
export class AdminPageComponent implements OnInit {
    private refreshListener: () => void;

    constructor(
        private readonly router: Router,
        private readonly saveService: SaveService,
        private readonly socketService: SocketClientService,
        public popupService: PopupService,
    ) {}

    games: Game[] = [];
    loading = false;

    back(): void {
        this.router.navigate([APP_ROUTES.home]);
    }

    createGame(): void {
        this.router.navigate([APP_ROUTES.formEdition]);
    }

    toggleVisibility(game: Game): void {
        if (game._id)
            this.saveService.updateGameVisibility(game._id, !game.visible).subscribe({
                error: () => {
                    this.popupService.open('Impossible de changer la visibilité.');
                },
            });
    }

    deleteGame(gameId: string | undefined): void {
        if (!gameId) {
            this.popupService.open('Id invalide.');
            return;
        }

        this.saveService.deleteGame(gameId).subscribe({
            error: (err) => {
                if (err.status === FORBIDDEN) {
                    this.popupService.open('Le jeu a déjà été supprimé.');
                } else {
                    this.popupService.open('Impossible de supprimer le jeu.');
                }
            },
        });
    }

    editGame(gameId: string | undefined): void {
        if (!gameId) {
            this.popupService.open('Id invalide.');
            return;
        }

        this.router.navigate([APP_ROUTES.edition], { queryParams: { id: gameId } });
    }

    refresh(): void {
        this.loading = true;

        this.saveService.getAllGames().subscribe({
            next: (games) => {
                this.games = games;
                this.loading = false;
            },
            error: () => {
                this.popupService.open('Impossible de charger les jeux.');
                this.loading = false;
            },
        });
    }

    ngOnInit(): void {
        this.refresh();
        this.refreshListener = () => {
            this.saveService.getAllGames().subscribe(games => {
                this.games = games;
            });
        };
        this.socketService.on<Game>(GatewayEvents.Update, this.refreshListener);
    }
}
