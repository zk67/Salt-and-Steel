import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { isStringValid } from '@app/utils/validation';
import { BonusTarget, DiceTarget, DieKind, StatKey } from '@common/enums/player.enums';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';

const BASE_HP = 6;
const BASE_SPEED = 6;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;
const NUMBER_OF_AVATARS = 12;
const HALF_RANDOM = 0.5;
const MESSAGE_SHOW_TIME = 1000;
const CHARACTER_PAGE_REFRESH_FLAG = 'waitingPageRefresh';

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
  readonly dieKindEnum = DieKind;
  readonly statKeyEnum = StatKey;

  showInvalidFormMessage = false;
  showInvalidNameMessage = false;

  unavailableAvatars: string[] = [];

  statDescriptions: Record<StatKey, string> = {
    [StatKey.Hp]: 'Points de vie. À 0, ton personnage est vaincu.',
    [StatKey.Speed]: 'Détermine qui agit en premier et aide à esquiver les coups.',
    [StatKey.Attack]: 'Ta force offensive. En combat, tu lances le dé assigné à Attaque.',
    [StatKey.Defense]: 'Ta résistance. En combat, tu lances le dé assigné à Défense.',
  };

  pirateNames: string[] = [
    'Barbe-Noire',
    'Anne la Rouge',
    'Jack le Borgne',
    'Capitaine Flint',
    "Mary l'Écarlate",
    "Le Crochet d'Argent",
    'Barbe-de-Fer',
    'Samuel Tempête',
    'Ragnar le Cruel',
    'Isabella la Furie',
    "Morgan l'Ombre",
    'Le Loup des Mers',
    'Edward le Sanguinaire',
    'Nina Vents-Noirs',
    'Capitaine Corbeau',
    'Le Kraken Fou',
    'Hector Brise-Lames',
    'Bartholomew le Rusé',
    'La Veuve Noire',
    'Jonas Trois-Doigts',
    'Pedro Lame-Rapide',
    'Viktor Barbe-Blanche',
    'Le Requin Rouge',
    'Thomas Coupe-Gorge',
    "Elena l'Ouragan",
    'Capitaine Mistral',
    'Le Fantôme des Flots',
    'Ivan le Marteau',
    "Sofia Dents-d'Or",
    'Le Serpent de Mer',
    'William Long-Sabre',
    'Carmen Feu-Vert',
    'Le Balafré',
    'Nathaniel Brume',
    'La Tigresse des Îles',
    'Marco Tempête-de-Sable',
    'Le Chacal Noir',
    'Rosa Poignard',
    'Capitaine Tonnerre',
    'Le Corsaire Écarlate',
    'Boris Coupe-Ancre',
    'Luna Vague-Sombre',
    'Le Vautour des Mers',
    "Gabriel Croc-d'Acier",
    'Mila Brise-Os',
    'Le Baron des Flots',
    'Élias Vent-du-Nord',
  ];

  avatars: string[] = Array.from(
    { length: NUMBER_OF_AVATARS },
    (_, i) => `assets/avatars/avatar-${i + 1}.png`,
  );

  private readonly onUnavailableAvatars = (avatars: string[]) => {
    this.unavailableAvatars = avatars;
  };

  getDieFor(target: DiceTarget): DieKind {
    const d6 = this.d6Target.value;
    if (!d6) {
      return DieKind.None;
    }
    return d6 === target ? DieKind.D6 : DieKind.D4;
  }

  getDieLabel(target: DiceTarget): string {
    const kind = this.getDieFor(target);
    if (kind === DieKind.None) {
      return 'D?';
    }
    return kind === DieKind.D6 ? 'D6' : 'D4';
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
        : 'Choisis un visage… et la mer te reconnaîtra.',
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

  private updateStatsHpSpeed(): void {
    const target = this.bonusTarget.value;
    const nextHp = BASE_HP + (target === BonusTarget.Hp ? 2 : 0);
    const nextSpeed = BASE_SPEED + (target === BonusTarget.Speed ? 2 : 0);

    this.hp.setValue(nextHp);
    this.speed.setValue(nextSpeed);
  }

  randomizeStats(): void {
    this.characterName.setValue(
      this.pirateNames[Math.floor(Math.random() * this.pirateNames.length)],
    );

    const availableAvatars = this.avatars.filter(
      (avatar) => !this.isAvatarUnavailable(avatar),
    );

    if (availableAvatars.length > 0) {
      const randomAvatar =
        availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
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
    if (!this.characterName.value || !this.avatar.value || !this.bonusTarget.value || !this.d6Target.value) {
      this.showInvalidFormMessage = true;
      setTimeout(() => {
        this.showInvalidFormMessage = false;
      }, MESSAGE_SHOW_TIME);
      return;
    }

    if (!isStringValid(this.characterName.value)) {
      this.showInvalidNameMessage = true;
      setTimeout(() => {
        this.showInvalidNameMessage = false;
      }, MESSAGE_SHOW_TIME);
      return;
    }

    const d6 = this.d6Target.value;
    let d4target: DiceTarget | null = null;
    if (d6 === DiceTarget.Attack) {
      d4target = DiceTarget.Defense;
    } else if (d6 === DiceTarget.Defense) {
      d4target = DiceTarget.Attack;
    }

    const player: Player = {
      id: '',
      name: this.characterName.value,
      imageUrl: this.avatar.value,
      position: { x: 0, y: 0 },
      speed: this.speed.value,
      hp: this.hp.value,
      maxHp: this.hp.value,
      attack: this.attack.value,
      defense: this.defense.value,
      d6target: this.d6Target.value,
      d4target,
      movementPoints: this.speed.value ?? 0,
      actionsLeft: 1,
      victoryPoints: 0,
      hasAbandoned: false,
      isOrganizer: false,
      turnOrder: 0,
    };

    const tryJoinCurrentGame = () => {
      if (!selectedJoinRoomId) {
        return;
      }
      this.socketService.joinRoom(selectedJoinRoomId);
      this.socketService.send(GatewayEvents.AddPlayerToCurrentGame, player);
    };

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    const selectedJoinRoomId = this.gameService.getSelectedJoinRoomId();
    const selectedHostGame = this.gameService.getSelectedHostGame();

    const onJoinCurrentGameResult = (result: { success: boolean }) => {
      this.socketService.off(GatewayEvents.JoinCurrentGameResult, onJoinCurrentGameResult);

      if (result.success) {
        this.gameService.clearSelectedHostGame();
        this.router.navigate(['/waiting']);
        return;
      }

      const retry = window.confirm(
        "La partie n'est plus disponible. Appuyez sur OK pour réessayer ou Annuler pour retourner à l'accueil.",
      );

      if (!retry) {
        this.gameService.clearSelectedJoinRoomId();
        this.router.navigate(['/home']);
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

      // rejoindre une partie existante
      if (selectedJoinRoomId) {
        tryJoinCurrentGame();
        return;
      }

      // créer une partie
      if (selectedHostGame) {
        player.isOrganizer = true;
        const roomId = crypto.randomUUID();
        this.gameService.setSelectedJoinRoomId(roomId);

        this.socketService.joinRoom(roomId);

        this.socketService.send(
          GatewayEvents.CreateGame,
          {
            gameDbId: selectedHostGame._id,
            gameId: roomId,
          },
          () => {
            this.socketService.send(GatewayEvents.AddPlayerToCurrentGame, player);
          },
        );
        return;
      }

      this.router.navigate(['/waiting']);
    };

    this.socketService.on(GatewayEvents.PlayerId, onPlayerId);
    this.socketService.send(GatewayEvents.GetPlayerId, player);
  }

  isAvatarUnavailable(avatar: string): boolean {
    if (this.avatar.value === avatar) {
      return false;
    }

    return this.unavailableAvatars.includes(avatar);
  }

  private onBeforeUnload = (): void => {
    sessionStorage.setItem(CHARACTER_PAGE_REFRESH_FLAG, '1');
    this.gameService.clearSelectedJoinRoomId();
    this.router.navigate(['/home']);
  };

  ngOnInit(): void {
    const wasRefreshing = sessionStorage.getItem(CHARACTER_PAGE_REFRESH_FLAG);
    if (wasRefreshing) {
      sessionStorage.removeItem(CHARACTER_PAGE_REFRESH_FLAG);
      this.router.navigate(['/home']);
      return;
    }
    const selectedRoomId = this.gameService.getSelectedJoinRoomId();

    if (!selectedRoomId) {
      return;
    }

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    this.socketService.joinRoom(selectedRoomId);
    this.socketService.on<string[]>(
      GatewayEvents.UnavailableAvatars,
      this.onUnavailableAvatars,
    );
    this.socketService.send(GatewayEvents.GetUnavailableAvatars);
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  ngOnDestroy(): void {
    const selectedRoomId = this.gameService.getSelectedJoinRoomId();

    if (selectedRoomId) {
      this.socketService.send(GatewayEvents.ClearSelectedAvatarInJoinForm);
    }

    this.socketService.off(GatewayEvents.UnavailableAvatars, this.onUnavailableAvatars);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }
}
