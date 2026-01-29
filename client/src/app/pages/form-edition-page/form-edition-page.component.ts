import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GameMode, MapSize } from '@common/types/map.interface';

@Component({
    selector: 'app-form-edition-page',
    templateUrl: './form-edition-page.component.html',
    styleUrls: ['./form-edition-page.component.scss'],
    imports: [FormsModule, RouterLink],
})

export class FormEditionPageComponent {
    selectedMode: GameMode = GameMode.Classic;
    selectedSize: MapSize = MapSize.Small;

    gameMode = GameMode;
    mapSize = MapSize;

    constructor(private router: Router) {}

    onSubmit(): void {
        const queryParams = {
            mode: this.selectedMode,
            size: this.selectedSize,
        };

        this.router.navigate(['/edition'], { queryParams });
    }
    getSizeDescription(): string {
        switch (this.selectedSize) {
            case MapSize.Small:
                return 'La taille petite est une grille de 10x10 pour 2 joueurs.';
            case MapSize.Medium:
                return 'La taille moyenne est une grille de 15x15 pour 2 à 4 joueurs.';
            case MapSize.Large:
                return 'La taille grande est une grille de 20x20 pour 2 à 6 joueurs.';
            default:
                return '';
        }
    }
}

