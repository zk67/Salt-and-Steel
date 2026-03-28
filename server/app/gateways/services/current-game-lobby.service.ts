import { GamesService } from '@app/database/game/services/game.service';
import { JoinableGameSummary } from '@app/interface/game.interface';
import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CurrentGameBroadcastService } from './current-game-broadcast.service';

@Injectable()
export class CurrentGameLobbyService {
    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly gamesService: GamesService,
        private readonly broadcastService: CurrentGameBroadcastService,
    ) {}

    async createGame(client: Socket, data: { gameDbId: string; gameId: string }): Promise<boolean> {
        const room = getRoomIdFromSocket(client);

        if (!room) {
            return false;
        }

        const game = await this.gamesService.getOneGame(data.gameDbId);

        if (!game) {
            this.logger.warn(`Game not found in DB for id: ${data.gameDbId}`);
            return false;
        }

        this.currentGamesService.createGame(game, room, data.gameId);

        this.logger.log(`Created game for room: ${room} with game name: ${game.name}`);
        this.emitJoinableGames();
        return true;
    }

    addPlayerToGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.addPlayerToGame(room, player);
        this.broadcastPlayers(room);
    }

    getPlayersToGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const players = this.currentGamesService.getPlayersToGame(room);
        client.emit(GatewayEvents.PlayersToGame, players);
    }

    emitJoinableGamesToClient(client: Socket): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        client.emit(GatewayEvents.JoinableGames, joinableGames);
    }

    handleAddPlayerToCurrentGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);

        if (!room) {
            this.logger.warn(`Impossible d'ajouter un joueur: aucune room pour le client ${client.id}`);
            client.emit(GatewayEvents.JoinCurrentGameResult, { success: false });
            return;
        }

        if (!this.currentGamesService.canJoinGame(room)) {
            this.logger.warn(`Impossible d'ajouter le joueur ${player.name}: salle verrouillee ou pleine (${room})`);
            client.emit(GatewayEvents.JoinCurrentGameResult, { success: false });
            return;
        }

        this.currentGamesService.addPlayerToGame(room, player);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (game && player.isOrganizer) {
            game.idHost = player.id;
        }

        this.logger.log(`Player ${player.name} added to current game in room ${room}`);
        this.broadcastPlayers(room);
        client.emit(GatewayEvents.JoinCurrentGameResult, { success: true });
        this.emitJoinableGames();
    }

    handleSurrender(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) {
            return;
        }

        const player = game.players.find((currentPlayer) => currentPlayer.id === client.id);
        const isHost = !!player?.isOrganizer;

        if (isHost && game.currentPhase === undefined) {
            this.logger.log(`Host ${client.id} is leaving: closing room ${room}`);
            this.currentGamesService.removeGame(room);
            this.broadcastService.emitGameClosed(room);
            this.emitJoinableGames();
            return;
        }

        if (this.currentGamesService.removePlayerFromGame(room, client.id)) {
            this.logger.log(`Player ${client.id} has surrendered in room: ${room}`);
            this.broadcastService.emitRemovePlayer(room, client.id);
            this.broadcastPlayers(room);
            this.emitUnavailableAvatars(room);
            this.emitJoinableGames();
        }

        if (game.idHost === client.id && this.currentGamesService.isDebugMode(room)) {
            this.logger.log(`Host ${client.id} has surrendered. Debug mode disabled in room: ${room}`);
            this.broadcastService.emitToggleDebugMode(room);
        }
    }

    handleKickPlayer(client: Socket, payload: { playerId: string }): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) {
            return;
        }

        if (client.id !== game.idHost) {
            this.logger.warn(`Non-host ${client.id} attempted to kick player ${payload.playerId} in room ${room}`);
            return;
        }

        if (payload.playerId === client.id) {
            return;
        }

        if (this.currentGamesService.removePlayerFromGame(room, payload.playerId)) {
            this.broadcastService.emitKicked(payload.playerId);
            this.broadcastService.emitRemovePlayer(room, payload.playerId);
            this.broadcastPlayers(room);
        }
    }

    handleGetUnavailableAvatars(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (!room) {
            client.emit(GatewayEvents.UnavailableAvatars, []);
            return;
        }

        const avatars = this.currentGamesService.getUnavailableAvatars(room);
        client.emit(GatewayEvents.UnavailableAvatars, avatars);
    }

    handleSelectAvatarInJoinForm(client: Socket, avatar: string): void {
        const room = getRoomIdFromSocket(client);
        if (!room) {
            return;
        }

        this.currentGamesService.setSelectedAvatar(room, client.id, avatar);
        this.emitUnavailableAvatars(room);
    }

    handleClearSelectedAvatarInJoinForm(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (!room) {
            return;
        }

        this.currentGamesService.clearSelectedAvatar(room, client.id);
        this.emitUnavailableAvatars(room);
    }

    private broadcastPlayers(roomId: string): void {
        const players = this.currentGamesService.getPlayersToGame(roomId);
        this.broadcastService.emitPlayers(roomId, players);
    }

    private emitJoinableGames(): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        this.broadcastService.emitJoinableGames(joinableGames);
    }

    private emitUnavailableAvatars(roomId: string): void {
        const avatars = this.currentGamesService.getUnavailableAvatars(roomId);
        this.broadcastService.emitUnavailableAvatars(roomId, avatars);
    }
}
