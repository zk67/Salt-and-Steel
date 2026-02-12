import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameCreatedComponent } from '@app/components/game-created/game-created.component';
import { SaveService } from '@app/services/save.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { Game } from '@common/types/game.interface';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, GameCreatedComponent],
})
export class AdminPageComponent implements OnInit {
    private refreshListener: () => void;

    constructor(
        private readonly router: Router,
        private readonly saveService: SaveService,
        private readonly socketService: SocketClientService,
    ) {}

    games: Game[] = [];
    loading = false;
    errorMsg = '';

    back(): void {
        this.router.navigate(['/home']);
    }

    createGame(): void {
        this.router.navigate(['/form-edition']);
    }

    toggleVisibility(game: Game): void {
        if (game._id)
            this.saveService.updateGameVisibility(game._id, !game.visible).subscribe({
                error: () => {
                    this.errorMsg = 'Impossible de changer la visibilité.';
                },
            });
    }

    deleteGame(gameId: string | undefined): void {
        if (!gameId) {
            this.errorMsg = 'Id invalide.';
            return;
        }

        this.saveService.deleteGame(gameId).subscribe({
            error: () => (this.errorMsg = 'Impossible de supprimer le jeu.'),
        });
    }

    editGame(gameId: string | undefined): void {
        if (!gameId) {
            this.errorMsg = 'Id invalide.';
            return;
        }

        this.router.navigate(['/edition'], { queryParams: { id: gameId } });
    }

    refresh(): void {
        this.loading = true;
        this.errorMsg = '';

        this.saveService.getAllGames().subscribe({
            next: (games) => {
                this.games = games;
                this.loading = false;
            },
            error: () => {
                this.errorMsg = 'Impossible de charger les jeux.';
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
        this.socketService.on<Game>('update', this.refreshListener);
    }
}
