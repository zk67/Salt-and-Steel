import { PlayableGame } from '@app/interface/game.interface';
import { DiceTarget } from '@common/enums/player.enums';
import {
    CombatParticipantRoundDetails,
    CombatPosture,
    CombatRoundDetails,
    CombatStatBreakdown,
} from '@common/interfaces/game.interface';
import { TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

const ICE_COMBAT_PENALTY = -2;
const DICE_6 = 6;
const DICE_4 = 4;
const POSTURE_BONUS = 2;
const MIN_DICE_VALUE = 1;

export class CombatRoundService {
    buildCombatRoundDetails(
        game: PlayableGame,
        attacker: Player,
        defender: Player,
        attackerPosture: CombatPosture,
        defenderPosture: CombatPosture,
    ): CombatRoundDetails {
        const attackerRound = this.createCombatParticipantRound(game, attacker, attackerPosture, true);
        const defenderRound = this.createCombatParticipantRound(game, defender, defenderPosture, false);

        attackerRound.damageDealt = Math.max(0, attackerRound.attack.total - defenderRound.defense.total);
        attackerRound.damageTaken = Math.max(0, defenderRound.attack.total - attackerRound.defense.total);
        defenderRound.damageDealt = attackerRound.damageTaken;
        defenderRound.damageTaken = attackerRound.damageDealt;

        return { attacker: attackerRound, defender: defenderRound };
    }

    private createCombatParticipantRound(
        game: PlayableGame,
        player: Player,
        posture: CombatPosture,
        isInstigator: boolean,
    ): CombatParticipantRoundDetails {
        const penalty = this.getPlayerCombatPenalty(game, player);
        const attackDiceResult = this.getCombatDiceResult(game, player, DiceTarget.Attack, isInstigator);
        const defenseDiceResult = this.getCombatDiceResult(game, player, DiceTarget.Defense, isInstigator);

        const attackPostureBonus = this.getPostureBonus(posture, CombatPosture.Offensive);
        const defensePostureBonus = this.getPostureBonus(posture, CombatPosture.Defensive);

        return {
            playerId: player.id,
            playerName: player.name,
            attack: this.createCombatBreakdown(
                player.attack ?? 0,
                attackDiceResult,
                penalty,
                attackPostureBonus,
            ),
            defense: this.createCombatBreakdown(
                player.defense ?? 0,
                defenseDiceResult,
                penalty,
                defensePostureBonus,
            ),
            damageDealt: 0,
            damageTaken: 0,
        };
    }

    private createCombatBreakdown(
        baseValue: number,
        diceResult: number,
        penalty: number,
        postureBonus: number,
    ): CombatStatBreakdown {
        return {
            baseValue,
            postureBonus,
            diceResult,
            penalty,
            total: baseValue + postureBonus + diceResult + penalty,
        };
    }

    private getPostureBonus(posture: CombatPosture, expected: CombatPosture): number {
        return posture === expected ? POSTURE_BONUS : 0;
    }

    private getPlayerCombatPenalty(game: PlayableGame, player: Player): number {
        const tile = game._game.tiles[player.position.y]?.[player.position.x];
        return tile?.tileType === TileType.Ice ? ICE_COMBAT_PENALTY : 0;
    }

    private getCombatDiceResult(
        game: PlayableGame,
        player: Player,
        target: DiceTarget,
        isInstigator: boolean,
    ): number {
        const sides = this.getDiceSides(player, target);
        if (sides === 0) {
            return 0;
        }

        if (game.debugMode) {
            return isInstigator ? sides : MIN_DICE_VALUE;
        }

        return this.rollDice(sides);
    }

    private getDiceSides(player: Player, target: DiceTarget): number {
        if (player.d6target === target) {
            return DICE_6;
        }

        if (player.d4target === target) {
            return DICE_4;
        }

        return 0;
    }

    private rollDice(sides: number): number {
        return Math.floor(Math.random() * sides) + 1;
    }
}