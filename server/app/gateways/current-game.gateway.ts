import { GamesService } from '@app/database/game/services/game.service';
import { CurrentGamesService, JoinableGameSummary } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { BattleWonPayload, DebugMovePayload, GameInfoPayload, MovePlayerPayload, ToggleDebugPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
        private readonly gamesService: GamesService,
    ) {}

    afterInit(): void {
        this.currentGamesService.setEmitCallback((roomId, payload) => {
            this.server.to(roomId).emit(GatewayEvents.NewTurn, payload);
        });
    }

    @SubscribeMessage(GatewayEvents.MovePlayer)
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Player ${payload.playerId} attempting to move ${payload.direction}`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        if (this.currentGamesService.movePlayer(room, payload.playerId, payload.direction)) {
            this.server.to(room).emit(GatewayEvents.PlayerMoved, payload);
            this.logger.log(`Player ${payload.playerId} moved ${payload.direction}`);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} in direction ${payload.direction}`);
        }
    }

    private validatePlayer(socket: Socket, playerId: string): boolean {
        const room = getRoomIdFromSocket(socket);

        if (playerId !== socket.id) {
            this.logger.warn(`Player ID ${playerId} does not match socket ID ${socket.id}`);
            return false;
        }

        const game = this.currentGamesService.getGameByRoomId(room);

        if (!game) {
            this.logger.warn(`Game not found for room ID: ${room}`);
            return false;
        }

        const player = game.players.find(p => p.id === socket.id);
        if (!player) {
            this.logger.warn(`Player not found in game for socket ID: ${socket.id}`);
            return false;
        }

        return true;
    }

    @SubscribeMessage(GatewayEvents.StartGame)
    startGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Starting game for room: ${room}`);
        const game = this.currentGamesService.startGame(room);
        this.logger.log(`Game started for room: ${room} with players: ${game?.players.map(p => p.name).join(', ')}`);

        const gameInfoPayload: GameInfoPayload = {
            players: game.players,
            game: game._game,
        };

        this.server.to(room).emit(GatewayEvents.GameStartInfo, gameInfoPayload);
    }

    @SubscribeMessage(GatewayEvents.CreateGame)
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

    @SubscribeMessage(GatewayEvents.AddPlayerToGame)
    addPlayerToGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.addPlayerToGame(room, player);
        this.broadcastPlayers(room);
    }

    @SubscribeMessage(GatewayEvents.GetPlayersToGame)
    getPlayersToGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const players = this.currentGamesService.getPlayersToGame(room);
        client.emit(GatewayEvents.PlayersToGame, players); // a tester pour savoir si c'est mieux ça ou client.emit (vérifier si ça envoie trop de requêtes (genre 1 pas personne alors qu'on a besoin d'un en tout))

    }

    private broadcastPlayers(roomId: string): void {
        const players = this.currentGamesService.getPlayersToGame(roomId);
        this.server.to(roomId).emit(GatewayEvents.PlayersToGame, players);
    }

    @SubscribeMessage(GatewayEvents.GetJoinableGames)
    handleGetJoinableGames(client: Socket): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        client.emit(GatewayEvents.JoinableGames, joinableGames);
    }

    @SubscribeMessage(GatewayEvents.EndTurnEarly)
    endTurnEarly(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.validateEndTurnEarly(room, client.id);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) return;
        const isCurrentPlayer = client.id === game.turnOrder[game.currentTurnIndex];
        const isHostDebug = client.id === game.idHost && game.debugMode;

        if (!isCurrentPlayer && !isHostDebug) return;
        this.currentGamesService.nextPlayerTurn(room);
    }

    @SubscribeMessage(GatewayEvents.DebugMove)
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move to (${payload.targetPos.x}, ${payload.targetPos.y})`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);

        if (this.currentGamesService.debugMove(room, payload.playerId, payload.targetPos)) {
            this.server.to(room).emit(GatewayEvents.HandleClickDebug, payload);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} to (${payload.targetPos.x}, ${payload.targetPos.y})`);
        }
    }

    @SubscribeMessage(GatewayEvents.BattleWon)
    handleBattleWon(client: Socket, payload: BattleWonPayload): void {
        if (!(this.validatePlayer(client, payload.winnerId) || this.validatePlayer(client, payload.loserId))) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const [updatedPayload, battleValid, isGameOver] = this.currentGamesService.battleWon(room, payload);

        if (battleValid) {
            this.server.to(room).emit(GatewayEvents.HandleBattleWon, updatedPayload);
            this.logger.log(`Player ${payload.winnerId} has won the battle against ${payload.loserId}`);

            if (isGameOver) {
                this.server.to(room).emit(GatewayEvents.GameOver, { winnerId: payload.winnerId });
            }
        }
    }

    @SubscribeMessage(GatewayEvents.Surrender)
    handleSurrender(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) return;

        const player = game.players.find((p) => p.id === client.id);
        const isHost = !!player?.isOrganizer;

        if (isHost) {
            this.logger.log(`Host ${client.id} is leaving: closing room ${room}`);
            this.currentGamesService.removeGame(room);
            this.server.to(room).emit(GatewayEvents.GameClosed);
            this.emitJoinableGames();
            return;
        }

        if (this.currentGamesService.removePlayerFromGame(room, client.id)) {
            this.logger.log(`Player ${client.id} has surrendered in room: ${room}`);
            this.server.to(room).emit(GatewayEvents.RemovePlayer, { playerId: client.id });
            this.broadcastPlayers(room);
            this.emitUnavailableAvatars(room);
            this.emitJoinableGames();
        }

        if (game.idHost === client.id && this.currentGamesService.isDebugMode(room)) {
            this.logger.log(`Host ${client.id} has surrendered. Debug mode disabled in room: ${room}`);
            this.server.to(room).emit(GatewayEvents.HandleToggleDebugMode);
        }
    }

    @SubscribeMessage(GatewayEvents.KickPlayer)
    handleKickPlayer(client: Socket, payload: { playerId: string; }): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) return;

        if (client.id !== game.idHost) {
            this.logger.warn(`Non-host ${client.id} attempted to kick player ${payload.playerId} in room ${room}`);
            return;
        }

        if (payload.playerId === client.id) {
            return;
        }

        if (this.currentGamesService.removePlayerFromGame(room, payload.playerId)) {
            this.server.to(payload.playerId).emit(GatewayEvents.Kicked);

            this.server.to(room).emit(GatewayEvents.RemovePlayer, { playerId: payload.playerId });
            this.broadcastPlayers(room);
        }
    }

    private emitJoinableGames(): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        this.server.emit(GatewayEvents.JoinableGames, joinableGames);
    }

    @SubscribeMessage(GatewayEvents.AddPlayerToCurrentGame)
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

    @SubscribeMessage(GatewayEvents.GetUnavailableAvatars)
    handleGetUnavailableAvatars(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            const avatars = this.currentGamesService.getUnavailableAvatars(room);
            client.emit(GatewayEvents.UnavailableAvatars, avatars);
        } else {
            client.emit(GatewayEvents.UnavailableAvatars, []);
            return;
        }

    }

    private emitUnavailableAvatars(roomId: string): void {
        const avatars = this.currentGamesService.getUnavailableAvatars(roomId);
        this.server.to(roomId).emit(GatewayEvents.UnavailableAvatars, avatars);
    }

    @SubscribeMessage(GatewayEvents.SelectAvatarInJoinForm)
    handleSelectAvatarInJoinForm(client: Socket, avatar: string): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            this.currentGamesService.setSelectedAvatar(room, client.id, avatar);
            this.emitUnavailableAvatars(room);
        }
    }

    @SubscribeMessage(GatewayEvents.ClearSelectedAvatarInJoinForm)
    handleClearSelectedAvatarInJoinForm(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            this.currentGamesService.clearSelectedAvatar(room, client.id);
            this.emitUnavailableAvatars(room);
        }
    }

    @SubscribeMessage(GatewayEvents.ToggleDebugMode)
    handleToggleDebugMode(client: Socket, payload: ToggleDebugPayload): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);

        if (!game) {
            this.logger.warn(`Game not found for room ID: ${room}`);
            return;
        }

        payload.hostId = game.idHost;
        payload.debugMode = !game.debugMode;
        if (client.id === game.idHost) {
            this.currentGamesService.toggleDebugMode(game, payload);
            this.server.to(room).emit(GatewayEvents.HandleToggleDebugMode, payload);
        }

        this.logger.log(`Toggled debug mode to ${payload.debugMode} for room: ${room}`);
    }
}
