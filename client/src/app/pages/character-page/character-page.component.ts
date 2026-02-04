import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

const BASELIFE = 6;
const BASESPEED = 6;
const BASEATTACK = 4;
const BASEDEFENSE = 4;
const NBAVATAR = 12;
const HALFRANDOM = 0.5;
const MAXNAME_LENGTH = 32;

@Component({
    selector: 'app-character-page',
    templateUrl: './character-page.component.html',
    styleUrls: ['./character-page.component.scss'],
    imports: [ReactiveFormsModule],
})

export class CharacterPageComponent {
    constructor(private router: Router) {}
    characterName = new FormControl('');
    avatar = new FormControl<string | null>(null);
    life = new FormControl<number>(BASELIFE);
    speed = new FormControl<number>(BASESPEED);
    attack = new FormControl<number>(BASEATTACK);
    defense = new FormControl<number>(BASEDEFENSE);

    bonusTarget: 'life' | 'speed';
    diceD6BonusTarget: 'attack' | 'defense';
    diceD4BonusTarget: 'attack' | 'defense';

    pirateName: string[] = [
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
        'Lucia Cœur-Sombre',
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
        'Oliver Œil-de-Verre',
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

    avatars: string[] = Array.from({ length: NBAVATAR }, (_, i) => `assets/avatars/avatar-${i + 1}.png`);

    selectAvatar(avatar: string) {
        this.avatar.setValue(avatar);
    }

    toggleBonus(target: 'life' | 'speed') {
        this.bonusTarget = target;
        this.updateStatsLifeSpeed();
    }

    private updateStatsLifeSpeed() {
        this.life.setValue(
            BASELIFE + (this.bonusTarget === 'life' ? 2 : 0));
        this.speed.setValue(
            BASESPEED + (this.bonusTarget === 'speed' ? 2 : 0));
    }

    toggleDiceBonus(target: 'attack' | 'defense') {
        if (target === 'attack') {
            this.diceD6BonusTarget = 'attack';
            this.diceD4BonusTarget = 'defense';
        } else {
            this.diceD6BonusTarget = 'defense';
            this.diceD4BonusTarget = 'attack';
        }
    }

    randomizeStats() {
        this.characterName.setValue(
            this.pirateName[Math.floor(Math.random() * this.pirateName.length)]);

        this.avatar.setValue(`assets/avatars/avatar-${Math.floor(Math.random() * NBAVATAR)}.png`);

        if (Math.random() < HALFRANDOM)
            this.toggleBonus('life');
        else
            this.toggleBonus('speed');

        if (Math.random() < HALFRANDOM)
            this.toggleDiceBonus('attack');
        else
            this.toggleDiceBonus('defense');
    }

    submitCharacter() {
        if (!this.characterName.value || !this.avatar.value || !this.bonusTarget || !this.diceD6BonusTarget) {
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
