import { PlayableGame } from '@app/interface/game.interface';
import { BattleWonPayload, CombatPosture, CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { MAX_VICTORIES } from '@common/types/game.constant';
import { findNearestFreeSpawn } from '@common/utils/map.utils';
import { CombatRoundService } from './combat-round.service';

export type CombatContext = {
    game: PlayableGame;
    attacker: Player;
    defender: Player;
    attackerId: string;
    defenderId: string;
};

export class CombatResolutionService {
    constructor(private readonly combatRoundService: CombatRoundService) {}

    getCombatContext(game: PlayableGame | undefined, playerId: string): CombatContext | null {
        if (!game?.activeCombat) {
            return null;
        }

        const { attackerId, defenderId } = game.activeCombat;
        const isParticipant = playerId === attackerId || playerId === defenderId;
        if (!isParticipant) {
            return null;
        }

        const attacker = game.players.find((player) => player.id === attackerId);
        const defender = game.players.find((player) => player.id === defenderId);
        if (!attacker || !defender) {
            return null;
        }

        return { game, attacker, defender, attackerId, defenderId };
    }

    submitPlayerPosture(game: PlayableGame, playerId: string, posture: CombatPosture)
        : { attackerPosture: CombatPosture; defenderPosture: CombatPosture } | null {
        if (!game.activeCombat) {
            return null;
        }

        const { attackerId, defenderId, postures } = game.activeCombat;
        postures[playerId] = posture;

        const attackerPosture = postures[attackerId];
        const defenderPosture = postures[defenderId];
        const bothChosen = attackerPosture !== CombatPosture.None && defenderPosture !== CombatPosture.None;

        if (!bothChosen) {
            return null;
        }

        return { attackerPosture, defenderPosture };
    }

    resolveCombatRound(
        combatContext: CombatContext,
        attackerPosture: CombatPosture,
        defenderPosture: CombatPosture,
    ): CombatRoundDetails {
        const { game, attacker, defender, attackerId, defenderId } = combatContext;
        const combatRound = this.combatRoundService.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            attackerPosture,
            defenderPosture,
        );

        attacker.hp = Math.max(0, (attacker.hp ?? 0) - combatRound.attacker.damageTaken);
        defender.hp = Math.max(0, (defender.hp ?? 0) - combatRound.defender.damageTaken);

        if (game.activeCombat) {
            game.activeCombat.postures[attackerId] = CombatPosture.None;
            game.activeCombat.postures[defenderId] = CombatPosture.None;
        }

        return combatRound;
    }

    isCombatFinished(attacker: Player, defender: Player): boolean {
        const attackerDead = (attacker.hp ?? 0) <= 0;
        const defenderDead = (defender.hp ?? 0) <= 0;

        return attackerDead || defenderDead;
    }

    finalizeCombatAfterRound(game: PlayableGame, battlePayload: BattleWonPayload, attacker: Player, defender: Player)
        : { payload: BattleWonPayload; isGameOver: boolean } {
        const attackerDead = (attacker.hp ?? 0) <= 0;
        const defenderDead = (defender.hp ?? 0) <= 0;
        if (attackerDead && defenderDead) {
            return { payload: battlePayload, isGameOver: false };
        }

        const winner = attackerDead ? defender : attacker;
        const loser = attackerDead ? attacker : defender;
        battlePayload.winnerId = winner.id;
        battlePayload.loserId = loser.id;
        battlePayload.winnerHp = winner.hp ?? 0;
        battlePayload.loserHp = loser.maxHp ?? loser.hp ?? 0;
        winner.victoryPoints = (winner.victoryPoints || 0) + 1;

        const isGameOver = winner.victoryPoints >= MAX_VICTORIES;
        loser.hp = loser.maxHp ?? loser.hp;

        const loserSpawn = game.spawnPoints?.get(loser.id);
        if (loserSpawn) {
            const respawnPos = findNearestFreeSpawn(game._game.tiles, loserSpawn, game.players, loser.id);
            loser.position = respawnPos;
            battlePayload.loserPos = respawnPos;
        }

        return { payload: battlePayload, isGameOver };
    }

    createBattlePayload(combatRound: CombatRoundDetails): BattleWonPayload {
        return {
            winnerId: '',
            loserId: '',
            loserPos: { x: 0, y: 0 },
            combatRound,
            winnerHp: 0,
            loserHp: 0,
        };
    }
}
