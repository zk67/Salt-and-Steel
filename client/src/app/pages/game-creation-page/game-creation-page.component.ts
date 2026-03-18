import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink ,Router } from '@angular/router';
import { GameCardComponent } from '@app/components/game/game-card/game-card.component';
import { GameService } from '@app/services/game/game.service';
import { SaveService } from '@app/services/save/save.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Game } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';


@Component({
  selector: 'app-game-creation-page',
  imports: [GameCardComponent, RouterLink],
  templateUrl: './game-creation-page.component.html',
  styleUrl: './game-creation-page.component.scss',
})

export class GameCreationPageComponent implements OnInit, OnDestroy {
  constructor(
    private saveService: SaveService,
    private socketService: SocketClientService,
    private router: Router,
    private gameService : GameService,
  ) {}

  private refreshListener: () => void;
  games: Game[] = [];

  ngOnInit(): void {
    this.getAllGames();

    this.refreshListener = () => {
      this.getAllGames();
    };

    this.socketService.on<Game>(GatewayEvents.Update, this.refreshListener);
  }

  ngOnDestroy(): void {
    this.socketService.off(GatewayEvents.Update, this.refreshListener);
  }

  getAllGames(): void {
    this.saveService.getAllVisibleGames().subscribe(games => {
      this.games = games;
    });
  }

  selectGame(game: Game): void {
    this.gameService.clearGameService();
    this.gameService.setSelectedHostGame(game);
    this.router.navigate(['/character-form']);
  }
}
