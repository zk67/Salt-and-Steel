import { PlayableGame } from '@app/interface/game.interface';
import { DiceTarget } from '@common/enums/player.enums';
import { CombatParticipantRoundDetails, CombatRoundDetails, CombatStatBreakdown } from '@common/interfaces/game.interface';
import { TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

const COMBAT_POSTURE_BONUS = 0;
const ICE_COMBAT_PENALTY = -2;
const DICE_6 = 6;
const DICE_4 = 4;

export class CombatRoundService {
    buildCombatRoundDetails(game: PlayableGame, attacker: Player, defender: Player): CombatRoundDetails {
        const attackerRound = this.createCombatParticipantRound(game, attacker);
        const defenderRound = this.createCombatParticipantRound(game, defender);

        attackerRound.damageDealt = Math.max(0, attackerRound.attack.total - defenderRound.defense.total);
        attackerRound.damageTaken = Math.max(0, defenderRound.attack.total - attackerRound.defense.total);
        defenderRound.damageDealt = attackerRound.damageTaken;
        defenderRound.damageTaken = attackerRound.damageDealt;

        return { attacker: attackerRound, defender: defenderRound };
    }

    private createCombatParticipantRound(game: PlayableGame, player: Player): CombatParticipantRoundDetails {
        const penalty = this.getPlayerCombatPenalty(game, player);
        const attackDiceResult = this.getCombatDiceResult(player, DiceTarget.Attack);
        const defenseDiceResult = this.getCombatDiceResult(player, DiceTarget.Defense);

        return {
            playerId: player.id,
            playerName: player.name,
            attack: this.createCombatBreakdown(player.attack ?? 0, attackDiceResult, penalty),
            defense: this.createCombatBreakdown(player.defense ?? 0, defenseDiceResult, penalty),
            damageDealt: 0,
            damageTaken: 0,
        };
    }

    private createCombatBreakdown(baseValue: number, diceResult: number, penalty: number): CombatStatBreakdown {
        return {
            baseValue,
            postureBonus: COMBAT_POSTURE_BONUS,
            diceResult,
            penalty,
            total: baseValue + COMBAT_POSTURE_BONUS + diceResult + penalty,
        };
    }

    private getPlayerCombatPenalty(game: PlayableGame, player: Player): number {
        const tile = game._game.tiles[player.position.y]?.[player.position.x];
        return tile?.tileType === TileType.Ice ? ICE_COMBAT_PENALTY : 0;
    }

    private getCombatDiceResult(player: Player, target: DiceTarget): number {
        if (player.d6target === target) {
            return this.rollDice(DICE_6);
        }
        if (player.d4target === target) {
            return this.rollDice(DICE_4);
        }
        return 0;
    }

    private rollDice(sides: number): number {
        return Math.floor(Math.random() * sides) + 1;
    }
}
