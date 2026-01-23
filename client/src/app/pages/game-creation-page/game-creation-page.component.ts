import { Component, OnInit } from '@angular/core';
import { GameCardComponent } from '@app/components/game/game-card/game-card.component';
import { GameService } from '@app/services/game.service';
import { Game } from '@common/classes/game';


@Component({
  selector: 'app-game-creation-page',
  imports: [GameCardComponent],
  templateUrl: './game-creation-page.component.html',
  styleUrl: './game-creation-page.component.scss',
})

export class GameCreationPageComponent implements OnInit {
  constructor(private gameService: GameService) {}

  games: Game[] = [];
  game: Game = {
    name: 'Aventure Épique',
    description: 'Un jeu passionnant avec exploration et stratégie.',
    minPlayers: 2,
    maxPlayers: 4,
    visible: true,
  };

  ngOnInit(): void {
    this.getAllGames();
  }

  getAllGames(): void {
    this.gameService.getAllGames().subscribe(games => {
      this.games = games;
    });
  }

  addGame(game: Game): void {
    this.gameService.addGame(game).subscribe(() => {
      this.getAllGames();
    });
  }

  getGame(_id: string): void {
    this.gameService.getGame(_id).subscribe(oneGame => {
      this.games.push(oneGame);
    });
  }

  deleteGame(_id: string): void {
    this.gameService.deleteGame(_id).subscribe(() => {
      this.getAllGames();
    });

  }
}