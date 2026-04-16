import { PlayableGame } from '@app/interface/game.interface';
import { GameMode } from '@common/interfaces/map.interface';
import { Player, Profile } from '@common/interfaces/player.interface';
import { VirtualPlayerTurnResult } from '@common/interfaces/virtual-player.interface';
import { arePositionAdjacent } from '@common/utils/map.utils';
import { VirtualPlayerCombatService } from './virtual-player-combat.service';
import { VirtualPlayerMovementService } from './virtual-player-movement.service';

export class VirtualPlayerTurnService {
    private readonly movement = new VirtualPlayerMovementService();
    private readonly combat = new VirtualPlayerCombatService();

    decideTurn(vp: Player, game: PlayableGame): VirtualPlayerTurnResult {
        return game._game.gameMode === GameMode.CTF
            ? this.decideCTFTurn(vp, game)
            : this.decideClassicTurn(vp, game);
    }

    // Classic
    private decideClassicTurn(vp: Player, game: PlayableGame): VirtualPlayerTurnResult {
        const enemies = game.players.filter(p => p.id !== vp.id && !p.hasAbandoned);

        const adjacentEnemy = enemies.find(e => arePositionAdjacent(vp.position, e.position));
        if (adjacentEnemy && vp.actionsLeft > 0) {
            return this.combatResult(vp, adjacentEnemy.id);
        }

        if (vp.actionsLeft > 0) {
            const tileAction = this.movement.findAdjacentTileAction(vp, game);
            if (tileAction) {
                return { moved: false, startedCombat: false, actionOnTile: tileAction };
            }
        }

        if (vp.movementPoints > 0) {
            const target = vp.virtualProfile === Profile.Aggressive
                ? this.movement.findNearestEnemy(vp, enemies, game)
                ?? this.movement.findFurthestSafePosition(vp, enemies, game)
                : this.movement.findFurthestSafePosition(vp, enemies, game);

            if (target) {
                const moved = this.movement.moveToward(vp, target, game);

                if (moved && vp.virtualProfile === Profile.Aggressive && vp.actionsLeft > 0) {
                    const newAdjacent = enemies.find(e => arePositionAdjacent(vp.position, e.position));
                    if (newAdjacent) {
                        return this.combatResult(vp, newAdjacent.id, true);
                    }
                }

                return { moved, startedCombat: false };
            }
        }

        return { moved: false, startedCombat: false };
    }

    // CTF
    private decideCTFTurn(vp: Player, game: PlayableGame): VirtualPlayerTurnResult {
        const enemies = game.players.filter(
            p => p.id !== vp.id && !p.hasAbandoned && p.isRedTeam !== vp.isRedTeam,
        );
        const flagCarrier = enemies.find(e => e.hasFlag);

        return vp.virtualProfile === Profile.Aggressive
            ? this.decideCTFAggressiveTurn(vp, game, enemies, flagCarrier)
            : this.decideCTFDefensiveTurn(vp, game, enemies, flagCarrier);
    }

    private decideCTFAggressiveTurn(
        vp: Player,
        game: PlayableGame,
        enemies: Player[],
        flagCarrier: Player | undefined,
    ): VirtualPlayerTurnResult {
        if (vp.hasFlag) {
            const spawnPos = game.spawnPoints?.get(vp.id);
            if (spawnPos) {
                this.movement.moveToward(vp, spawnPos, game);
                return { moved: true, startedCombat: false };
            }
        }

        if (flagCarrier) {
            if (arePositionAdjacent(vp.position, flagCarrier.position) && vp.actionsLeft > 0) {
                return this.combatResult(vp, flagCarrier.id);
            }
            this.movement.moveToward(vp, flagCarrier.position, game);
            return { moved: true, startedCombat: false };
        }

        const flagPos = this.movement.findFlagPosition(game);
        if (flagPos) {
            this.movement.moveToward(vp, flagPos, game);
            return { moved: true, startedCombat: false };
        }

        const adjacent = enemies.find(e => arePositionAdjacent(vp.position, e.position));
        if (adjacent && vp.actionsLeft > 0) {
            return this.combatResult(vp, adjacent.id);
        }

        const nearest = this.movement.findNearestEnemy(vp, enemies, game);
        if (nearest) this.movement.moveToward(vp, nearest, game);
        return { moved: true, startedCombat: false };
    }

    private decideCTFDefensiveTurn(
        vp: Player,
        game: PlayableGame,
        enemies: Player[],
        flagCarrier: Player | undefined,
    ): VirtualPlayerTurnResult {
        // 1. Carry flag home
        if (vp.hasFlag) {
            const spawnPos = game.spawnPoints?.get(vp.id);
            if (spawnPos) {
                this.movement.moveToward(vp, spawnPos, game);
                return { moved: true, startedCombat: false };
            }
        }

        if (flagCarrier) {
            const interceptTarget = game.spawnPoints?.get(flagCarrier.id) ?? flagCarrier.position;

            if (arePositionAdjacent(vp.position, flagCarrier.position) && vp.actionsLeft > 0) {
                return this.combatResult(vp, flagCarrier.id);
            }

            this.movement.moveToward(vp, interceptTarget, game);
            return { moved: true, startedCombat: false };
        }

        const flagPos = this.movement.findFlagPosition(game);
        if (flagPos) {
            this.movement.moveToward(vp, flagPos, game);
            return { moved: true, startedCombat: false };
        }

        const safePos = this.movement.findFurthestSafePosition(vp, enemies, game);
        if (safePos) this.movement.moveToward(vp, safePos, game);
        return { moved: false, startedCombat: false };
    }

    private combatResult(vp: Player, defenderId: string, moved = false): VirtualPlayerTurnResult {
        return {
            moved,
            startedCombat: true,
            attackerId: vp.id,
            defenderId,
            posture: this.combat.getCombatPosture(vp),
        };
    }
}