import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppMaterialModule } from '@app/modules/material.module';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { Game } from '@common/classes/game';
import { GameCreatedComponent } from '@app/components/game-created/game-created.component';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [AppMaterialModule, CommonModule ,GameCreatedComponent],
})

export class AdminPageComponent implements OnInit {
    constructor(
        private readonly router: Router,
        private readonly gameService: GameService,
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
            this.gameService.updateGameVisibility(game._id, !game.visible).subscribe({
                next: () => {
                    this.refresh();
                    this.socketService.send('refresh');
                },
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

        this.gameService.deleteGame(gameId).subscribe({
            next: () => {
                this.refresh();
                this.socketService.send('refresh');
            },
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

        this.gameService.getAllGames().subscribe({
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
    }
}
