import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { isStringValid } from '@app/utils/validation';
import { Player } from '@common/types/player.interface';

const BASE_LIFE = 6;
const BASE_SPEED = 6;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;
const NUMBER_OF_AVATARS = 12;
const HALF_RANDOM = 0.5;

type StatKey = 'life' | 'speed' | 'attack' | 'defense';
type BonusTarget = 'life' | 'speed';
type DiceTarget = 'attack' | 'defense';
type DieKind = 'd4' | 'd6' | 'none';

@Component({
  selector: 'app-character-page',
  templateUrl: './character-page.component.html',
  styleUrls: ['./character-page.component.scss'],
  imports: [ReactiveFormsModule],
})
export class CharacterPageComponent {
  clientPlayer?: Player;

  private onPlayerId = (p: Player) => {
    if (this.clientPlayer) {
      this.clientPlayer.id = p.id;
      this.gameService.setClientPlayer(this.clientPlayer); // Ajout du joueur côté client
      this.socketService.send('addPlayerToGame', this.clientPlayer); // Envoi du joueur au serveur
      this.router.navigate(['/waiting']);
    }
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private socketService: SocketClientService,
    private gameService: GameService,
  ) {}

  ngOnInit(): void {
    this.socketService.on('playerId', this.onPlayerId);
  }

  ngOnDestroy(): void {
    this.socketService.off('playerId', this.onPlayerId);
  }

  characterName = new FormControl('');
  avatar = new FormControl<string | null>(null);

  bonusTarget = new FormControl<BonusTarget | null>(null);
  d6Target = new FormControl<DiceTarget | null>(null);

  life = new FormControl<number>(BASE_LIFE);
  speed = new FormControl<number>(BASE_SPEED);
  attack = new FormControl<number>(BASE_ATTACK);
  defense = new FormControl<number>(BASE_DEFENSE);

  statDescriptions: Record<StatKey, string> = {
    life: 'Points de vie. À 0, ton personnage est vaincu.',
    speed: 'Détermine qui agit en premier et aide à esquiver les coups.',
    attack: 'Ta force offensive. En combat, tu lances le dé assigné à Attaque.',
    defense: 'Ta résistance. En combat, tu lances le dé assigné à Défense.',
  };

  showFormTooltip = false;

  pirateNames: string[] = [
    'Barbe-Noire',
    'Anne la Rouge',
    'Jack le Borgne',
    'Capitaine Flint',
    'Mary l\'Écarlate',
    'Le Crochet d\'Argent',
    'Barbe-de-Fer',
    'Samuel Tempête',
    'Ragnar le Cruel',
    'Isabella la Furie',
    'Morgan l\'Ombre',
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
    'Elena l\'Ouragan',
    'Capitaine Mistral',
    'Le Fantôme des Flots',
    'Ivan le Marteau',
    'Sofia Dents-d\'Or',
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
    'Gabriel Croc-d\'Acier',
    'Mila Brise-Os',
    'Le Baron des Flots',
    'Élias Vent-du-Nord',
  ];

  avatars: string[] = Array.from({ length: NUMBER_OF_AVATARS }, (_, i) => `assets/avatars/avatar-${i + 1}.png`);

  getDieFor(target: DiceTarget): DieKind {
    const d6 = this.d6Target.value;
    if (!d6) return 'none';
    return d6 === target ? 'd6' : 'd4';
  }

  getDieLabel(target: DiceTarget): string {
    const kind = this.getDieFor(target);
    if (kind === 'none') return 'D?';
    return kind === 'd6' ? 'D6' : 'D4';
  }

  getDieSummary(): string {
    if (!this.d6Target.value) return 'Non assignés';
    const atk = this.getDieLabel('attack');
    const def = this.getDieLabel('defense');
    return `Attaque: ${atk} · Défense: ${def}`;
  }

  get bonusSummary(): string {
    if (!this.bonusTarget.value) return 'Non choisi';
    return this.bonusTarget.value === 'life' ? '+2 Vie' : '+2 Rapidité';
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
    lines.push(chosen ? 'Son regard vaut une menace, et sa lame parle plus vite que les canons.' : 'Choisis un visage… et la mer te reconnaîtra.');
    return lines.join('\n');
  }

  selectAvatar(a: string): void {
    this.avatar.setValue(a);
  }

  toggleBonus(target: BonusTarget): void {
    this.bonusTarget.setValue(target);
    this.updateStatsLifeSpeed();
  }

  toggleDiceBonus(target: DiceTarget): void {
    this.d6Target.setValue(target);
  }

  private updateStatsLifeSpeed(): void {
    const target = this.bonusTarget.value;
    const nextLife = BASE_LIFE + (target === 'life' ? 2 : 0);
    const nextSpeed = BASE_SPEED + (target === 'speed' ? 2 : 0);

    this.life.setValue(nextLife);
    this.speed.setValue(nextSpeed);
  }

  randomizeStats(): void {
    this.characterName.setValue(this.pirateNames[Math.floor(Math.random() * this.pirateNames.length)]);
    this.avatar.setValue(this.avatars[Math.floor(Math.random() * this.avatars.length)]);

    const bonus: BonusTarget = Math.random() < HALF_RANDOM ? 'life' : 'speed';
    const d6: DiceTarget = Math.random() < HALF_RANDOM ? 'attack' : 'defense';

    this.bonusTarget.setValue(bonus);
    this.d6Target.setValue(d6);
    this.updateStatsLifeSpeed();
  }

  submitCharacter(): void {
    if (!this.characterName.value || !this.avatar.value || !this.bonusTarget || !this.d6Target) {
      alert('Veuillez remplir le formulaire au complet!');
      return;
    }

    if (!isStringValid(this.characterName.value)) {
      alert(`Le nom du personnage est invalide!`);
      return;
    }

    this.clientPlayer = {
      id: '',
      name: this.characterName.value,
      imageUrl: this.avatar.value,
      x: 0,
      y: 0,
      energy: 0,
      speed: this.speed.value,
      life: this.life.value,
      attack: this.attack.value,
      defense: this.defense.value,
      d6target: this.d6Target.value,
    };

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    this.socketService.joinRoom('default-room'); // TODO: remplacer 'default-room' par une room dynamique si besoin (a faire avant le merge)

    if (history.state.from === 'create') {
      const id = this.route.snapshot.queryParams.gameId;
      this.socketService.send('createGame', { id }, () => {
        this.socketService.send('getPlayerId', this.clientPlayer);
      });
    } else {
      this.socketService.send('getPlayerId', this.clientPlayer);
    }
  }
}