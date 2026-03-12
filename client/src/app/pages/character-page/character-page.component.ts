import { Component ,OnInit ,OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
export class CharacterPageComponent implements OnInit ,OnDestroy{

  constructor(
    private router: Router,
    private socketService: SocketClientService,
    private gameService: GameService,
  ) {}

  characterName = new FormControl('');
  avatar = new FormControl<string | null>(null);

  bonusTarget = new FormControl<BonusTarget | null>(null);
  d6Target = new FormControl<DiceTarget | null>(null);

  life = new FormControl<number>(BASE_LIFE);
  speed = new FormControl<number>(BASE_SPEED);
  attack = new FormControl<number>(BASE_ATTACK);
  defense = new FormControl<number>(BASE_DEFENSE);

  unavailableAvatars: string[] = [];

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
    if (!this.isAvatarUnavailable(a) || this.avatar.value === a){
      this.avatar.setValue(a);
      if (this.gameService.getSelectedJoinRoomId()) {
        this.socketService.send('selectAvatarInJoinForm', a);
      }
    }
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

  private readonly onUnavailableAvatars = (avatars: string[]) => {
    this.unavailableAvatars = avatars;
  };

  randomizeStats(): void {
    this.characterName.setValue(this.pirateNames[Math.floor(Math.random() * this.pirateNames.length)]);
    const availableAvatars = this.avatars.filter((avatar) => !this.isAvatarUnavailable(avatar));
    if (availableAvatars.length > 0) {
      const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
      this.avatar.setValue(randomAvatar);

      if (this.gameService.getSelectedJoinRoomId()) {
        this.socketService.send('selectAvatarInJoinForm', randomAvatar);
      }
    }

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
      alert('Le nom du personnage est invalide!');
      return;
    }
    const player: Player = {
      id: '',
      name: this.characterName.value,
      imageUrl: this.avatar.value,
      x: 0,
      y: 0,
      energy: 0,
      speed: this.speed.value ?? BASE_SPEED,
      life: this.life.value ?? BASE_LIFE,
      attack: this.attack.value ?? BASE_ATTACK,
      defense: this.defense.value ?? BASE_DEFENSE,
      d6target: this.d6Target.value,
      victoryPoints: 0,
    };

    if (!this.socketService.isSocketAlive()) {
      this.socketService.connect();
    }

    const selectedRoomId = this.gameService.getSelectedJoinRoomId();

    if (selectedRoomId) {
      this.socketService.joinRoom(selectedRoomId);
    }
    
    const onJoinCurrentGameResult = (result: { success: boolean }) =>{
      this.socketService.off('joinCurrentGameResult', onJoinCurrentGameResult);
      if (result.success) {
        this.gameService.clearSelectedJoinRoomId();
        this.router.navigate(['/waiting']);
        return;
      }
      const retry = window.confirm("La partie n'est plus disponible. Appuyez sur OK pour réessayer ou Annuler pour retourner à l'accueil.");
      if (!retry) {
        this.gameService.clearSelectedJoinRoomId();
        this.router.navigate(['/home']);
      }
      
    };

    const onPlayerId = (p: Player) => {
      this.socketService.off('playerId', onPlayerId);
      player.id = p.id;
      this.gameService.addPlayer(player);

      this.socketService.on('joinCurrentGameResult', onJoinCurrentGameResult);
      this.socketService.send('addPlayerToCurrentGame', player);
    };

    this.socketService.on('playerId', onPlayerId);
    this.socketService.send('getPlayerId', player);
  }

  isAvatarUnavailable(avatar: string): boolean {
    if (this.avatar.value === avatar) {
      return false;
    }
    return this.unavailableAvatars.includes(avatar);
  }

  ngOnInit(): void {
    const selectedRoomId = this.gameService.getSelectedJoinRoomId();
    if (selectedRoomId){
      if (!this.socketService.isSocketAlive()) {
        this.socketService.connect();
      }
      this.socketService.joinRoom(selectedRoomId);
      this.socketService.on<string[]>('unavailableAvatars', this.onUnavailableAvatars);
      this.socketService.send('getUnavailableAvatars');
    }
    }

  ngOnDestroy(): void {
    const selectedRoomId = this.gameService.getSelectedJoinRoomId();
    if (selectedRoomId) {
      this.socketService.send('clearSelectedAvatarInJoinForm');
    }
    this.socketService.off('unavailableAvatars', this.onUnavailableAvatars);
  }
}
