import { PlayableGame } from '@app/interface/game.interface';
import { CombatPosture } from '@common/enums/game.enums';
import { GameMode, MapObjectType } from '@common/enums/map.enums';
import { BattleWonPayload, CombatRoundDetails, UpdateFlagPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { MAX_VICTORIES } from '@common/types/game.constant';
import { Position, findNearestFreeSpawn } from '@common/utils/map.utils';
import { Logger } from '@nestjs/common/services/logger.service';
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

        if (postures[playerId] !== CombatPosture.None) {
            return null;
        }

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
        : { payload: BattleWonPayload; isGameOver: boolean; flagPayload?: UpdateFlagPayload } {
        const attackerDead = (attacker.hp ?? 0) <= 0;
        const defenderDead = (defender.hp ?? 0) <= 0;

        if (attackerDead && defenderDead) {
            return this.finalizeDoubleKo(game, battlePayload, attacker, defender);
        }

        const { winner, loser } = this.resolveWinnerAndLoser(attacker, defender, attackerDead);
        this.applyBattleResults(battlePayload, winner, loser);

        const isGameOver = winner.stats.victoryPoints >= MAX_VICTORIES;
        const flagPayload = this.handleFlagDrop(game, loser);
        this.respawnLoser(game, loser, battlePayload);

        return { payload: battlePayload, isGameOver, flagPayload };
    }

    private finalizeDoubleKo(
        game: PlayableGame,
        battlePayload: BattleWonPayload,
        attacker: Player,
        defender: Player,
    ): { payload: BattleWonPayload; isGameOver: boolean; flagPayload?: UpdateFlagPayload } {
        const flagPayload = this.handleFlagDrop(game, attacker) ?? this.handleFlagDrop(game, defender);

        attacker.hp = attacker.maxHp ?? attacker.hp;
        defender.hp = defender.maxHp ?? defender.hp;

        const attackerRespawnPos = this.respawnPlayer(game, attacker);
        const defenderRespawnPos = this.respawnPlayer(game, defender);

        battlePayload.doubleKo = true;
        battlePayload.attackerRespawn = {
            playerId: attacker.id,
            position: attackerRespawnPos,
            hp: attacker.hp ?? 0,
        };
        battlePayload.defenderRespawn = {
            playerId: defender.id,
            position: defenderRespawnPos,
            hp: defender.hp ?? 0,
        };

        return {
            payload: battlePayload,
            isGameOver: false,
            flagPayload,
        };
    }

    private resolveWinnerAndLoser(attacker: Player, defender: Player, attackerDead: boolean) {
        const winner = attackerDead ? defender : attacker;
        const loser = attackerDead ? attacker : defender;

        winner.stats.victoryPoints = (winner.stats.victoryPoints || 0) + 1;
        loser.hp = loser.maxHp ?? loser.hp;

        return { winner, loser };
    }

    private applyBattleResults(battlePayload: BattleWonPayload, winner: Player, loser: Player): void {
        battlePayload.winnerId = winner.id;
        battlePayload.loserId = loser.id;
        battlePayload.winnerHp = winner.hp ?? 0;
        battlePayload.loserHp = loser.maxHp ?? loser.hp ?? 0;
    }

    private handleFlagDrop(game: PlayableGame, loser: Player): UpdateFlagPayload | undefined {
        if (game._game.gameMode !== GameMode.CTF || !loser.hasFlag) {
            return;
        }
        loser.hasFlag = false;

        const tile = game._game.tiles[loser.position.y][loser.position.x];
        tile.mapObject = MapObjectType.Flag;

        Logger.warn(`${loser.name} lost the flag.`);

        return {
            playerId: loser.id,
            flagStatus: false,
            position: loser.position,
        };
    }

    private respawnPlayer(game: PlayableGame, player: Player): Position {
        const spawn = game.spawnPoints?.get(player.id);
        if (!spawn) {
            return player.position;
        }

        const respawnPos = findNearestFreeSpawn(game._game.tiles, spawn, game.players, player.id);
        player.position = respawnPos;

        return respawnPos;
    }

    private respawnLoser(game: PlayableGame, loser: Player, battlePayload: BattleWonPayload): void {
        const respawnPos = this.respawnPlayer(game, loser);
        battlePayload.loserPos = respawnPos;
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
