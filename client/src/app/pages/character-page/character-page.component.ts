import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { generateUUID, isStringValid } from '@app/utils/validation';
import { BonusTarget, DiceKind, DiceTarget, StatKey } from '@common/enums/player.enums';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import {
  BASE_ATTACK, BASE_DEFENSE, BASE_HP, BASE_SPEED, CHARACTER_PAGE_AVATARS,
  CHARACTER_PAGE_REFRESH_FLAG, CHARACTER_STAT_DESCRIPTIONS, HALF_RANDOM, MESSAGE_SHOW_TIME, PIRATE_NAMES,
} from './character-page.constants';

@Component({
  selector: 'app-character-page',
  templateUrl: './character-page.component.html',
  styleUrls: ['./character-page.component.scss'],
  imports: [ReactiveFormsModule],
})
export class CharacterPageComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    private socketService: SocketClientService,
    private gameService: GameService,
  ) {}

  characterName = new FormControl('');
  avatar = new FormControl<string | null>(null);
  bonusTarget = new FormControl<BonusTarget | null>(null);
  d6Target = new FormControl<DiceTarget | null>(null);

  hp = new FormControl<number>(BASE_HP);
  speed = new FormControl<number>(BASE_SPEED);
  attack = new FormControl<number>(BASE_ATTACK);
  defense = new FormControl<number>(BASE_DEFENSE);
  readonly bonusTargetEnum = BonusTarget;
  readonly diceTargetEnum = DiceTarget;
  readonly dieKindEnum = DiceKind;
  readonly statKeyEnum = StatKey;

  showInvalidFormMessage = false;
  showInvalidNameMessage = false;
  isSubmitting = false;

  unavailableAvatars: string[] = [];
  statDescriptions: Record<StatKey, string> = CHARACTER_STAT_DESCRIPTIONS;
  pirateNames: string[] = PIRATE_NAMES;
  avatars: string[] = CHARACTER_PAGE_AVATARS;

  private readonly onUnavailableAvatars = (avatars: string[]) => {
    this.unavailableAvatars = avatars;
  };

  getDieFor(target: DiceTarget): DiceKind {
    const d6 = this.d6Target.value;
    if (!d6) {
      return DiceKind.None;
    }
    return d6 === target ? DiceKind.D6 : DiceKind.D4;
  }

  getDieLabel(target: DiceTarget): string {
    const kind = this.getDieFor(target);
    if (kind === DiceKind.None) {
      return 'D?';
    }
    return kind === DiceKind.D6 ? 'D6' : 'D4';
  }

  getDieSummary(): string {
    if (!this.d6Target.value) {
      return 'Non assignés';
    }

    const atk = this.getDieLabel(DiceTarget.Attack);
    const def = this.getDieLabel(DiceTarget.Defense);
    return `Attaque: ${atk} · Défense: ${def}`;
  }

  get bonusSummary(): string {
    if (!this.bonusTarget.value) return 'Non choisi';
    return this.bonusTarget.value === BonusTarget.Hp ? '+2 Vie' : '+2 Rapidité';
  }

  get pirateTitle(): string {
    return 'Le Roc des Sept Mers';
  }

  get pirateDescription(): string {
    const name = this.characterName.value?.trim();
    const chosen = this.avatar.value != null;
    const lines: string[] = [];

    lines.push(
      name
        ? `Ancien mousse devenu capitaine, ${name} jure par l'or et la loyauté.`
        : 'Pirate ...',
    );

    lines.push(
      chosen
        ? 'Son regard vaut une menace, et sa lame parle plus vite que les canons.'
        : 'Choisis un visage¦ et la mer te reconnaitra.',
    );

    return lines.join('\n');
  }

  selectAvatar(a: string): void {
    if (this.isAvatarUnavailable(a) && this.avatar.value !== a) {
      return;
    }

    this.avatar.setValue(a);

    if (this.gameService.getSelectedJoinRoomId()) {
      this.socketService.send(GatewayEvents.SelectAvatarInJoinForm, a);
    }
  }

  toggleBonus(target: BonusTarget): void {
    this.bonusTarget.setValue(target);
    this.updateStatsHpSpeed();
  }

  toggleDiceBonus(target: DiceTarget): void {
    this.d6Target.setValue(target);
  }

  randomizeStats(): void {
    this.characterName.setValue(this.pirateNames[Math.floor(Math.random() * this.pirateNames.length)]);

    const availableAvatars = this.avatars.filter((avatar) => !this.isAvatarUnavailable(avatar));

    if (availableAvatars.length > 0) {
      const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
      this.avatar.setValue(randomAvatar);

      if (this.gameService.getSelectedJoinRoomId()) {
        this.socketService.send(GatewayEvents.SelectAvatarInJoinForm, randomAvatar);
      }
    }

    const bonus: BonusTarget = Math.random() < HALF_RANDOM ? BonusTarget.Hp : BonusTarget.Speed;
    const d6: DiceTarget = Math.random() < HALF_RANDOM ? DiceTarget.Attack : DiceTarget.Defense;

    this.bonusTarget.setValue(bonus);
    this.d6Target.setValue(d6);
    this.updateStatsHpSpeed();
  }

  submitCharacter(): void {
    if (this.isSubmitting || !this.isCharacterFormValid()) {
      return;
    }

    this.isSubmitting = true;
    const characterName = this.characterName.value ?? '';
    const avatar = this.avatar.value ?? '';
    const d6 = this.d6Target.value;
    const d4target =
      d6 === DiceTarget.Attack ? DiceTarget.Defense : d6 === DiceTarget.Defense ? DiceTarget.Attack : null;
    const player: Player = {
      id: '',
      name: characterName,
      imageUrl: avatar,
      position: { x: 0, y: 0 },
      speed: this.speed.value ?? BASE_SPEED,
      hp: this.hp.value ?? BASE_HP,
      maxHp: this.hp.value ?? BASE_HP,
      attack: this.attack.value ?? BASE_ATTACK,
      defense: this.defense.value ?? BASE_DEFENSE,
      d6target: this.d6Target.value,
      d4target,
      movementPoints: this.speed.value ?? BASE_SPEED,
      actionsLeft: 1,
      hasAbandoned: false,
      isOrganizer: false,
      turnOrder: 0,
      stats: {
        victoryPoints: 0,
        combatPoints: 0,
        defeatPoints: 0,
        totalLifeLost: 0,
        totalDamageDealt: 0,
        percentageOfTileVisited: 0,
      },
      visitedTiles: [],
    };

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    const selectedJoinRoomId = this.gameService.getSelectedJoinRoomId();
    const selectedHostGame = this.gameService.getSelectedHostGame();
    const tryJoinCurrentGame = () => this.tryJoinCurrentGame(selectedJoinRoomId, player);
    const onJoinCurrentGameResult = (result: { success: boolean }) => {
      this.socketService.off(GatewayEvents.JoinCurrentGameResult, onJoinCurrentGameResult);

      if (result.success) {
        this.gameService.clearSelectedHostGame();
        this.router.navigate([APP_ROUTES.waiting]);
        return;
      }

      const retry = window.confirm(
        "La partie n'est plus disponible. Appuyez sur OK pour réessayer ou Annuler pour retourner à l'accueil.",
      );

      if (!retry) {
        this.gameService.clearSelectedJoinRoomId();
        this.router.navigate([APP_ROUTES.home]);
        return;
      }

      this.socketService.on(GatewayEvents.JoinCurrentGameResult, onJoinCurrentGameResult);
      tryJoinCurrentGame();
    };

    const onPlayerId = (p: Player) => {
      this.socketService.off(GatewayEvents.PlayerId, onPlayerId);
      player.id = p.id;
      this.gameService.setClientPlayer(player);
      this.socketService.on(GatewayEvents.JoinCurrentGameResult, onJoinCurrentGameResult);

      if (selectedJoinRoomId) {
        tryJoinCurrentGame();
        return;
      }

      if (selectedHostGame?._id) {
        this.createHostedGame(selectedHostGame._id, player);
        return;
      }

      this.router.navigate([APP_ROUTES.waiting]);
    };

    this.socketService.on(GatewayEvents.PlayerId, onPlayerId);
    this.socketService.send(GatewayEvents.GetPlayerId, player);
  }

  goHome(): void {
    this.router.navigate([APP_ROUTES.home]);
  }
  goBack(): void {
    this.router.navigate([this.gameService.getSelectedHostGame() ? APP_ROUTES.gameCreation : APP_ROUTES.joinGame]);
  }

  isAvatarUnavailable(avatar: string): boolean {
    if (this.avatar.value === avatar) {
      return false;
    }

    return this.unavailableAvatars.includes(avatar);
  }

  ngOnInit(): void {
    const wasRefreshing = sessionStorage.getItem(CHARACTER_PAGE_REFRESH_FLAG);
    if (wasRefreshing) {
      sessionStorage.removeItem(CHARACTER_PAGE_REFRESH_FLAG);
      this.router.navigate([APP_ROUTES.home]);
      return;
    }

    window.addEventListener('beforeunload', this.onBeforeUnload);

    const selectedRoomId = this.gameService.getSelectedJoinRoomId();
    if (!selectedRoomId) {
      return;
    }

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    this.socketService.joinRoom(selectedRoomId);
    this.socketService.on<string[]>(GatewayEvents.UnavailableAvatars, this.onUnavailableAvatars);
    this.socketService.send(GatewayEvents.GetUnavailableAvatars);
  }

  ngOnDestroy(): void {
    const selectedRoomId = this.gameService.getSelectedJoinRoomId();

    if (selectedRoomId) {
      this.socketService.send(GatewayEvents.ClearSelectedAvatarInJoinForm);
    }

    this.socketService.off(GatewayEvents.UnavailableAvatars, this.onUnavailableAvatars);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private updateStatsHpSpeed(): void {
    const target = this.bonusTarget.value;
    this.hp.setValue(BASE_HP + (target === BonusTarget.Hp ? 2 : 0));
    this.speed.setValue(BASE_SPEED + (target === BonusTarget.Speed ? 2 : 0));
  }

  private tryJoinCurrentGame(selectedJoinRoomId: string | null, player: Player): void {
    if (!selectedJoinRoomId) {
      return;
    }

    this.socketService.joinRoom(selectedJoinRoomId);
    this.socketService.send(GatewayEvents.AddPlayerToCurrentGame, player);
  }

  private createHostedGame(gameDbId: string, player: Player): void {
    player.isOrganizer = true;
    const roomId = generateUUID();
    this.gameService.setSelectedJoinRoomId(roomId);
    this.socketService.joinRoom(roomId);
    this.socketService.send(
      GatewayEvents.CreateGame,
      { gameDbId, gameId: roomId },
      () => this.socketService.send(GatewayEvents.AddPlayerToCurrentGame, player),
    );
  }

  private isCharacterFormValid(): boolean {
    if (!this.characterName.value || !this.avatar.value || !this.bonusTarget.value || !this.d6Target.value) {
      this.showInvalidFormMessage = true;
      setTimeout(() => {
        this.showInvalidFormMessage = false;
      }, MESSAGE_SHOW_TIME);
      return false;
    }

    if (!isStringValid(this.characterName.value)) {
      this.showInvalidNameMessage = true;
      setTimeout(() => {
        this.showInvalidNameMessage = false;
      }, MESSAGE_SHOW_TIME);
      return false;
    }

    return true;
  }

  private onBeforeUnload = (): void => {
    sessionStorage.setItem(CHARACTER_PAGE_REFRESH_FLAG, '1');
    this.gameService.clearSelectedJoinRoomId();
    this.router.navigate([APP_ROUTES.home]);
  };
}
