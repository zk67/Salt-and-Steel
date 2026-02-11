import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

const BASELIFE = 6;
const BASESPEED = 6;
const BASEATTACK = 4;
const BASEDEFENSE = 4;
const NBAVATAR = 12;
const MAXNAME_LENGTH = 32;
const HALFRANDOM = 0.5;

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
  constructor(private router: Router){}
  characterName = new FormControl('');
  avatar = new FormControl<string | null>(null);

  bonusTarget = new FormControl<BonusTarget | null>(null);
  d6Target = new FormControl<DiceTarget | null>(null);

  life = new FormControl<number>(BASELIFE);
  speed = new FormControl<number>(BASESPEED);
  attack = new FormControl<number>(BASEATTACK);
  defense = new FormControl<number>(BASEDEFENSE);

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
    'Lucia Cœur-Sombre',
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
    'Oliver Œil-de-Verre',
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

  avatars: string[] = Array.from({ length: NBAVATAR }, (_, i) => `assets/avatars/avatar-${i + 1}.png`);

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
    const nextLife = BASELIFE + (target === 'life' ? 2 : 0);
    const nextSpeed = BASESPEED + (target === 'speed' ? 2 : 0);

    this.life.setValue(nextLife);
    this.speed.setValue(nextSpeed);
  }

  randomizeStats(): void {
    this.characterName.setValue(this.pirateNames[Math.floor(Math.random() * this.pirateNames.length)]);
    this.avatar.setValue(this.avatars[Math.floor(Math.random() * this.avatars.length)]);

    const bonus: BonusTarget = Math.random() < HALFRANDOM ? 'life' : 'speed';
    const d6: DiceTarget = Math.random() < HALFRANDOM ? 'attack' : 'defense';

    this.bonusTarget.setValue(bonus);
    this.d6Target.setValue(d6);
    this.updateStatsLifeSpeed();
  }

  submitCharacter() {
        if (!this.characterName.value || !this.avatar.value || !this.bonusTarget || !this.d6Target) {
            alert('Veuillez remplir le formulaire au complet!');
            return;
        }

        if (this.characterName.value.length > MAXNAME_LENGTH) {
            alert('Le nom du personnage ne doit pas dépasser 32 caractères!');
            return;
        }

        this.router.navigate(['/waiting']);
    }
}
