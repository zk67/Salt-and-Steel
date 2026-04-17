import { AfterViewInit, Component, computed, ElementRef, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { GameService } from '@app/services/game/game.service';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import {
  ActionOnTilePayload, ActiveCombatPayload, BattleWonPayload,
  CombatRoundDetails, NewTurnPayload, PassFlagPayload, ToggleDebugPayload, UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { TurnPhase } from '@common/enums/game.enums';
import { MapObjectType, TileType } from '@common/enums/map.enums';
import { GatewayEvents } from '@common/types/gateway.events';


@Component({
  selector: 'app-journal-de-jeu',
  templateUrl: './journal-de-jeu.component.html',
  styleUrls: ['./journal-de-jeu.component.scss'],
  imports: [],
})
export class JournalDeJeuComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;
  readonly messages = signal<ChatMessage[]>([]);
  readonly playerName = signal<string>('');
  private _currentCombatKey: string = '';
  activePlayer = computed(() => this.gameService.activePlayer());

  constructor(private socketService: SocketClientService, private gameService: GameService, private mapService: MapService) {}

  ngOnInit(): void {
    this.messages.set(this.gameService.getGameLogMessages());
    this.socketService.on(GatewayEvents.NewTurn, this.newTurn);
    this.socketService.on(GatewayEvents.CombatStarted, this.combatStarted);
    this.socketService.on(GatewayEvents.HandleBattleWon, this.combatEnded);
    this.socketService.on(GatewayEvents.ActionOnTile, this.mapAction);
    this.socketService.on(GatewayEvents.HandleToggleDebugMode, this.toggleDebugMode);
    this.socketService.on(GatewayEvents.RemovePlayer, this.surrender);
    this.socketService.on(GatewayEvents.GameOver, this.gameOver);
    this.socketService.on(GatewayEvents.HandleCombatRound, this.combatRoundDetails);
    this.socketService.on(GatewayEvents.HandlePassFlag, this.passFlag);
    this.socketService.on(GatewayEvents.HandleUpdateFlag, this.flagUpdate);
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.socketService.off(GatewayEvents.NewTurn, this.newTurn);
    this.socketService.off(GatewayEvents.CombatStarted, this.combatStarted);
    this.socketService.off(GatewayEvents.HandleBattleWon, this.combatEnded);
    this.socketService.off(GatewayEvents.ActionOnTile, this.mapAction);
    this.socketService.off(GatewayEvents.HandleToggleDebugMode, this.toggleDebugMode);
    this.socketService.off(GatewayEvents.RemovePlayer, this.surrender);
    this.socketService.off(GatewayEvents.GameOver, this.gameOver);
    this.socketService.off(GatewayEvents.HandleCombatRound, this.combatRoundDetails);
    this.socketService.off(GatewayEvents.HandlePassFlag, this.passFlag);
    this.socketService.off(GatewayEvents.HandleUpdateFlag, this.flagUpdate);
  }

  formatTime(): string {
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  private passFlag = (payload: PassFlagPayload) => {
    const players = this.gameService.getPlayers();
    const initiator = players.find((player) => player.id === payload.initiatorId);
    const receiver = players.find((player) => player.id === payload.targetId);
    const message: ChatMessage = {
      author: 'System',
      content: `${initiator?.name} a passé le drapeau à ${receiver?.name} !`,
      time: this.formatTime(),
    };
    this.addMessage(message);
  };

  private gameOver = (payload: { winnerId: string }) => {
    const players = this.gameService.getPlayers();
    const winner = players.find((player) => player.id === payload.winnerId);
    const remainingPlayers = players.filter((player) => player.id !== payload.winnerId).map((player) => player.name).join(', ');

    const message: ChatMessage = {
      author: 'System',
      content: `Le jeu est terminé ! Le gagnant est ${winner?.name} ! Joueurs restants : ${remainingPlayers || 'aucun autre joueur'}.`,
      time: this.formatTime(),
    };
    this.addMessage(message);
  };

  private combatRoundDetails = (payload: CombatRoundDetails) => {
    const clientPlayer = this.gameService.clientPlayer();
    const clientId = clientPlayer?.id;

    const isAttacker = payload.attacker.playerId === clientId;
    const self = isAttacker ? payload.attacker : payload.defender;

    const messageSelfAttack: ChatMessage = {
      author: 'System',
      content: `Tes données d'attaque : 
      valeur de base = ${self.attack.baseValue},
      bonus de posture = ${self.attack.postureBonus}, 
      résultat de dé = ${self.attack.diceResult},
      malus = ${self.attack.penalty}, 
      total = ${self.attack.total}`,
      time: this.formatTime(),
    };
    this.addMessage(messageSelfAttack);

    const messageSelfDefense: ChatMessage = {
      author: 'System',
      content: `Tes données de défense : 
      valeur de base = ${self.defense.baseValue},
      bonus de posture = ${self.defense.postureBonus},
      résultat de dé = ${self.defense.diceResult}, 
      malus = ${self.defense.penalty}, 
      total = ${self.defense.total}`,
      time: this.formatTime(),
    };
    this.addMessage(messageSelfDefense);

    const opponent = isAttacker ? payload.defender : payload.attacker;

    const damageSelfVsOpponent = Math.abs(self.attack.total - opponent.defense.total);
    const damageOpponentVsSelf = Math.abs(opponent.attack.total - self.defense.total);

    const messageDiffSelf: ChatMessage = {
      author: 'System',
      content: `Différence entre ton attaque et la défense de ${opponent.playerName} : ${damageSelfVsOpponent}
       (résultat : ${self.damageDealt > 0 ? 'dégâts infligés' : 'aucun dégât'})`,
      time: this.formatTime(),
    };
    this.addMessage(messageDiffSelf);

    const messageDiffOpponent: ChatMessage = {
      author: 'System',
      content: `Différence entre l'attaque de ${opponent.playerName} et ta défense : ${damageOpponentVsSelf}
       (résultat : ${self.damageTaken > 0 ? 'dégâts subis' : 'aucun dégât'})`,
      time: this.formatTime(),
    };
    this.addMessage(messageDiffOpponent);


  };

  private surrender = (payload: { playerId: string }) => {
    const players = this.gameService.getPlayers();
    const player = players.find((findPlayer) => findPlayer.id === payload.playerId);

    const message: ChatMessage = {
      author: 'System',
      content: `${player?.name} a abandonné !`,
      time: this.formatTime(),
    };
    this.addMessage(message);
  };

  private toggleDebugMode = (payload: ToggleDebugPayload) => {
    if (payload.debugMode) {
      const message: ChatMessage = {
        author: 'System',
        content: `Le mode debug a été activé !`,
        time: this.formatTime(),
      };
      this.addMessage(message);

    } else {
      const message: ChatMessage = {
        author: 'System',
        content: `Le mode debug a été désactivé !`,
        time: this.formatTime(),
      };
      this.addMessage(message);
    }
  };

  private mapAction = (payload: ActionOnTilePayload) => {
    const players = this.gameService.getPlayers();
    const player = players.find((findPlayer) => findPlayer.id === payload.playerId);
    const tile = this.mapService.getTile(payload.position);

    if (tile?.tileType === TileType.OpenDoor) {
      const message: ChatMessage = {
        author: 'System',
        content: `${player?.name} a ouvert une porte !`,
        time: this.formatTime(),
      };
      this.addMessage(message);

    }
    if (tile?.tileType === TileType.CloseDoor) {
      const message: ChatMessage = {
        author: 'System',
        content: `${player?.name} a fermé une porte !`,
        time: this.formatTime(),
      };
      this.addMessage(message);
    }

    if (tile?.mapObject === MapObjectType.CombatShrine) {
      const message: ChatMessage = {
        author: 'System',
        content: `${player?.name} a activé un sanctuaire de combat !`,
        time: this.formatTime(),
      };
      this.addMessage(message);

    }
    if (tile?.mapObject === MapObjectType.HealingShrine) {
      const message: ChatMessage = {
        author: 'System',
        content: `${player?.name} a activé un sanctuaire de soin !`,
        time: this.formatTime(),
      };
      this.addMessage(message);
    }
  };

  private combatStarted = (payload: ActiveCombatPayload) => {
    const combatKey = `${payload.attackerId}-${payload.defenderId}`;

    if (this._currentCombatKey === combatKey) {
      return;
    }
    this._currentCombatKey = combatKey;

    const players = this.gameService.getPlayers();
    const attacker = players.find((player) => player.id === payload.attackerId);
    const defender = players.find((player) => player.id === payload.defenderId);

    const message: ChatMessage = {
      author: 'System',
      content: `Un combat a commencé entre ${attacker?.name} et ${defender?.name} !`,
      time: this.formatTime(),
    };
    this.addMessage(message);
  };

  private combatEnded = (payload: BattleWonPayload) => {
    const players = this.gameService.getPlayers();

    if (payload.doubleKo) {
      const attackerId = payload.attackerRespawn?.playerId;
      const defenderId = payload.defenderRespawn?.playerId;

      const attacker = players.find((player) => player.id === attackerId);
      const defender = players.find((player) => player.id === defenderId);

      const attackerName = attacker?.name;
      const defenderName = defender?.name;

      const doubleKoMessage: ChatMessage = {
        author: 'System',
        content: `Le combat est terminé par un double KO entre ${attackerName} et ${defenderName} !`,
        time: this.formatTime(),
      };

      this.addMessage(doubleKoMessage);
      this._currentCombatKey = '';
      return;
    }

    const winner = players.find((player) => player.id === payload.winnerId);
    const loser = players.find((player) => player.id === payload.loserId);

    const winnerName = winner?.name;
    const loserName = loser?.name;

    const resultMessage: ChatMessage = {
      author: 'System',
      content: `Le combat est terminé !
       ${winnerName} a remporté le combat contre ${loserName} !
       (${winnerName}: ${payload.winnerHp} PV restants, ${loserName}: 0 PV)`,
      time: this.formatTime(),
    };

    this.addMessage(resultMessage);
    this._currentCombatKey = '';
  };

  private flagUpdate = (payload: UpdateFlagPayload) => {
    const players = this.gameService.getPlayers();
    const player = players.find((findPlayer) => findPlayer.id === payload.playerId);

    const message: ChatMessage = {
      author: 'System',
      content: payload.flagStatus ? `${player?.name} a ramassé le drapeau !` : `${player?.name} a perdu le drapeau !`,
      time: this.formatTime(),
    };
    this.addMessage(message);

  };

  private newTurn = (payload: NewTurnPayload) => {
    if (payload.phase !== TurnPhase.Turn) {
      return;
    }

    const message: ChatMessage = {
      author: 'System',
      content: `Nouveau tour pour : ${this.activePlayer()?.name} !`,
      time: this.formatTime(),
    };

    this.addMessage(message);
  };

  private addMessage = (msg: ChatMessage) => {
    this.messages.update((messages) => [...messages, msg]);
    this.gameService.setGameLogMessages(this.messages());
    setTimeout(() => this.scrollToBottom(), 0);
  };

  private scrollToBottom(): void {
    const messagesContainer = this.messagesContainer?.nativeElement;
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }


  getMessageClass(msg: ChatMessage): string {
    const messageClass = msg.content;
    if (messageClass.includes('Nouveau tour')) return 'msg-turn';
    if (messageClass.includes('combat a commencé')) return 'msg-combat-start';
    if (messageClass.includes('combat est terminé')) return 'msg-combat-end';
    if (messageClass.includes("données d'attaque") || messageClass.includes('données de défense') || messageClass.includes('Différence entre'))
      return 'msg-combat-round';
    if (messageClass.includes('drapeau')) return 'msg-flag';
    if (messageClass.includes('porte')) return 'msg-door';
    if (messageClass.includes('sanctuaire')) return 'msg-shrine';
    if (messageClass.includes('debug')) return 'msg-debug';
    if (messageClass.includes('abandonné')) return 'msg-surrender';
    if (messageClass.includes('jeu est terminé')) return 'msg-gameover';
    return '';
  }
}