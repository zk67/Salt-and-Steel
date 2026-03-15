import { CurrentGamesService, JoinableGameSummary } from '@app/current-games.service';
import { GamesService } from '@app/database/game/services/game.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { BattleWonPayload, DebugMovePayload, GameInfoPayload, MovePlayerPayload, ToggleDebugPayload } from '@common/types/game.interface';
import { Player } from '@common/types/player.interface';
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
            this.server.to(roomId).emit('newTurn', payload);
        });
    }

    @SubscribeMessage('movePlayer')
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Player ${payload.playerId} attempting to move ${payload.direction}`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        if (this.currentGamesService.movePlayer(room, payload.playerId, payload.direction)) {
            this.server.to(room).emit('playerMoved', payload);
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

    @SubscribeMessage('startGame')
    startGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.logger.log(`Starting game for room: ${room}`);
        const game = this.currentGamesService.startGame(room);
        this.logger.log(`Game started for room: ${room} with players: ${game?.players.map(p => p.name).join(', ')}`);

        const gameInfoPayload: GameInfoPayload = {
            players: game.players,
            game: game._game,
        };

        this.server.to(room).emit('gameStartInfo', gameInfoPayload);
    }

    @SubscribeMessage('createGame')
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

    @SubscribeMessage('addPlayerToGame')
    addPlayerToGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.addPlayerToGame(room, player);
        this.broadcastPlayers(room);
    }

    @SubscribeMessage('getPlayersToGame')
    getPlayersToGame(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const players = this.currentGamesService.getPlayersToGame(room);
        client.emit('playersToGame', players); // a tester pour savoir si c'est mieux ça ou client.emit (vérifier si ça envoie trop de requêtes (genre 1 pas personne alors qu'on a besoin d'un en tout))

    }

    private broadcastPlayers(roomId: string): void {
        const players = this.currentGamesService.getPlayersToGame(roomId);
        this.server.to(roomId).emit('playersToGame', players);
    }

    @SubscribeMessage('getJoinableGames')
    handleGetJoinableGames(client: Socket): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        client.emit('joinableGames', joinableGames);
    }

    @SubscribeMessage('endTurnEarly')
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


    @SubscribeMessage('debugMove')
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move to (${payload.x}, ${payload.y})`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);

        if (this.currentGamesService.debugMove(room, payload.playerId, payload.x, payload.y)) {
            this.server.to(room).emit('handleClickDebug', payload);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} to (${payload.x}, ${payload.y})`);
        }
    }

    @SubscribeMessage('battleWon')
    handleBattleWon(client: Socket, payload: BattleWonPayload): void {
        if (!this.validatePlayer(client, payload.winnerId) || !this.validatePlayer(client, payload.loserId)) {
            return;
        }

        const room = getRoomIdFromSocket(client);
        const [updatedPayload, battleValid, isGameOver] = this.currentGamesService.battleWon(room, payload);

        if (battleValid) {
            this.server.emit('handleBattleWon', updatedPayload);
            this.logger.log(`Player ${payload.winnerId} has won the battle against ${payload.loserId}`);


            if (isGameOver) {
                this.server.to(room).emit('gameOver', { winnerId: payload.winnerId });
            }
        }
    }

    @SubscribeMessage('surrender')
    handleSurrender(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (!game) return;

        const player = game.players.find((p) => p.id === client.id);
        const isHost = !!player?.isOrganizer;

        if (isHost) {
            this.logger.log(`Host ${client.id} is leaving: closing room ${room}`);
            this.currentGamesService.removeGame(room);
            this.server.to(room).emit('gameClosed');
            this.emitJoinableGames();
            return;
        }

        if (this.currentGamesService.removePlayerFromGame(room, client.id)) {
            this.logger.log(`Player ${client.id} has surrendered in room: ${room}`);
            this.server.to(room).emit('removePlayer', { playerId: client.id });
            this.broadcastPlayers(room);
            this.emitUnavailableAvatars(room);
            this.emitJoinableGames();
        }

        if (game.idHost === client.id && this.currentGamesService.isDebugMode(room)) {
            this.logger.log(`Host ${client.id} has surrendered. Debug mode disabled in room: ${room}`);
            this.server.to(room).emit('handleToggleDebugMode');
        }
    }

    @SubscribeMessage('kickPlayer')
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
            this.server.to(payload.playerId).emit('kicked');

            this.server.to(room).emit('removePlayer', { playerId: payload.playerId });
            this.broadcastPlayers(room);
        }
    }

    private emitJoinableGames(): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        this.server.emit('joinableGames', joinableGames);
    }

    @SubscribeMessage('addPlayerToCurrentGame')
    handleAddPlayerToCurrentGame(client: Socket, player: Player): void {
        const room = getRoomIdFromSocket(client);

        if (!room) {
            this.logger.warn(`Impossible d'ajouter un joueur: aucune room pour le client ${client.id}`);
            client.emit('joinCurrentGameResult', { success: false });
            return;
        }

        if (!this.currentGamesService.canJoinGame(room)) {
            this.logger.warn(`Impossible d'ajouter le joueur ${player.name}: salle verrouillee ou pleine (${room})`);
            client.emit('joinCurrentGameResult', { success: false });
            return;
        }

        this.currentGamesService.addPlayerToGame(room, player);
        const game = this.currentGamesService.getGameByRoomId(room);
        if (game && player.isOrganizer) {
            game.idHost = player.id;
        }
        this.logger.log(`Player ${player.name} added to current game in room ${room}`);
        this.broadcastPlayers(room);
        client.emit('joinCurrentGameResult', { success: true });
        this.emitJoinableGames();
    }

    @SubscribeMessage('getUnavailableAvatars')
    handleGetUnavailableAvatars(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            const avatars = this.currentGamesService.getUnavailableAvatars(room);
            client.emit('unavailableAvatars', avatars);
        } else {
            client.emit('unavailableAvatars', []);
            return;
        }

    }

    private emitUnavailableAvatars(roomId: string): void {
        const avatars = this.currentGamesService.getUnavailableAvatars(roomId);
        this.server.to(roomId).emit('unavailableAvatars', avatars);
    }

    @SubscribeMessage('selectAvatarInJoinForm')
    handleSelectAvatarInJoinForm(client: Socket, avatar: string): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            this.currentGamesService.setSelectedAvatar(room, client.id, avatar);
            this.emitUnavailableAvatars(room);
        }
    }

    @SubscribeMessage('clearSelectedAvatarInJoinForm')
    handleClearSelectedAvatarInJoinForm(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            this.currentGamesService.clearSelectedAvatar(room, client.id);
            this.emitUnavailableAvatars(room);
        }
    }

    @SubscribeMessage('toggleDebugMode')
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
            this.server.to(room).emit('handleToggleDebugMode', payload);
        }

        this.logger.log(`Toggled debug mode to ${payload.debugMode} for room: ${room}`);
    }
}
