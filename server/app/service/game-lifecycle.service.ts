import { JoinableGameSummary, PlayableGame } from '@app/interface/game.interface';
import { MapObjectType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/utils/map.utils';

const RANDOM_RANGE = 0.5;

export class GameLifecycleService {
    initializeTurnOrder(players: Player[]): string[] {
        const shuffled = [...players].sort(() => Math.random() - RANDOM_RANGE);
        const sorted = shuffled.sort((a, b) => b.speed - a.speed);

        sorted.forEach((player, idx) => {
            player.turnOrder = idx;
        });

        return sorted.map((p) => p.id);
    }

    allocateSpawnPoints(game: PlayableGame): void {
        const nbPlayers = game.players.length;
        const spawnPoints: Position[] = [];

        for (let y = 0; y < game._game.tiles.length; y++) {
            for (let x = 0; x < game._game.tiles[y].length; x++) {
                if (game._game.tiles[y][x].mapObject === MapObjectType.SpawnPoint) {
                    spawnPoints.push({ x, y });
                }
            }
        }

        const shuffled = spawnPoints.sort(() => Math.random() - RANDOM_RANGE);

        game.spawnPoints = new Map();
        game.players.forEach((player, index) => {
            player.position = shuffled[index];
            game.spawnPoints.set(player.id, shuffled[index]);
        });

        shuffled.slice(nbPlayers).forEach(({ x, y }) => {
            game._game.tiles[y][x].mapObject = MapObjectType.None;
        });
    }

    getJoinableGames(games: PlayableGame[]): JoinableGameSummary[] {
        return games
            .filter((game) => game.players.length < game._game.maxPlayers && game.currentPhase === undefined)
            .map((game) => {
                return { roomId: game.roomId, game: game._game, playerCount: game.players.length };
            });
    }

    canJoinGame(game: PlayableGame | undefined): boolean {
        if (!game) {
            return false;
        }
        return game.players.length < game._game.maxPlayers && game.currentPhase === undefined;
    }

    createTeams(game: PlayableGame): void {
        const players = [...game.players];

        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        const half = players.length / 2;
        players.forEach((player, index) => {
            player.isRedTeam = index < half;
        });
    }
}
