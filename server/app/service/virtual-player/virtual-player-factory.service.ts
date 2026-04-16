import { DiceTarget } from '@common/enums/player.enums';
import { Player, Profile } from '@common/interfaces/player.interface';
import {
    BASE_ATTACK, BASE_DEFENSE, BASE_HP, BASE_SPEED,
    HALF_RANDOM, NUMBER_OF_AVATARS, PIRATE_NAMES, STAT_BONUS,
} from '@common/types/player.constants';

export class VirtualPlayerFactoryService {
    createVirtualPlayer(id: string, profile: Profile, existingPlayers: Player[]): Player {
        const usedNames = new Set(existingPlayers.map(p => p.name));
        const availableNames = PIRATE_NAMES.filter(n => !usedNames.has(n));
        const name = availableNames[Math.floor(Math.random() * availableNames.length)];
        const usedAvatars = new Set(existingPlayers.map(p => p.imageUrl));
        const allAvatars = Array.from({ length: NUMBER_OF_AVATARS }, (_, i) => `assets/avatars/avatar-${i + 1}.png`);
        const availableAvatars = allAvatars.filter(a => !usedAvatars.has(a));
        const imageUrl = availableAvatars.length > 0
            ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
            : allAvatars[0];
        const bonusHp = Math.random() < HALF_RANDOM;
        const d6Attack = Math.random() < HALF_RANDOM;
        const hp = BASE_HP + (bonusHp ? STAT_BONUS : 0);
        const speed = BASE_SPEED + (!bonusHp ? STAT_BONUS : 0);

        return {
            id,
            name,
            imageUrl,
            position: { x: 0, y: 0 },
            speed,
            hp,
            maxHp: hp,
            attack: BASE_ATTACK,
            defense: BASE_DEFENSE,
            d6target: d6Attack ? DiceTarget.Attack : DiceTarget.Defense,
            d4target: d6Attack ? DiceTarget.Defense : DiceTarget.Attack,
            movementPoints: speed,
            actionsLeft: 1,
            hasAbandoned: false,
            isOrganizer: false,
            turnOrder: 0,
            isVirtual: true,
            virtualProfile: profile,
            stats: {
                combatPoints: 0,
                victoryPoints: 0,
                defeatPoints: 0,
                totalLifeLost: 0,
                totalDamageDealt: 0,
                percentageOfTileVisited: 0,
            },
            shrineBuffs: undefined,
            visitedTiles: [],
            isRedTeam: undefined,
            hasFlag: undefined,
        };
    }
}