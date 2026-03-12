import { Game, MovePlayerPayload, GameInfoPayload, DebugMovePayload, BattleWonPayload } from '@common/types/game.interface';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CurrentGamesService ,JoinableGameSummary } from '@app/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { Player } from '@common/types/player.interface';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit  {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly currentGamesService: CurrentGamesService,
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
    createGame(client: Socket, game: Game): void {
        const room = getRoomIdFromSocket(client);
        if (!room){
            return;
        }
        this.currentGamesService.createGame(game, room);
        this.logger.log(`Created game for room: ${room} with game name: ${game.name}`);
        this.emitJoinableGames();
    }

    @SubscribeMessage('getJoinableGames')
    handleGetJoinableGames(client: Socket): void {
        const joinableGames: JoinableGameSummary[] = this.currentGamesService.getJoinableGames();
        client.emit('joinableGames', joinableGames);
    }
    
    @SubscribeMessage('endTurnEarly')
    endTurnEarly(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        this.currentGamesService.nextPlayerTurn(room);
    }


    @SubscribeMessage('debugMove')
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.logger.log(`Player ${payload.playerId} attempting to move to (${payload.x}, ${payload.y})`);

        if (!this.validatePlayer(client, payload.playerId)) {
            return;
        }

        if (this.currentGamesService.debugMove(client.rooms[0], payload.playerId, payload.x, payload.y)) {
            this.server.emit('handleClickDebug', payload);
        } else {
            this.logger.warn(`Failed to move player ${payload.playerId} to (${payload.x}, ${payload.y})`);
        }
    }

    @SubscribeMessage('battleWon')
    handleBattleWon(client: Socket, payload: BattleWonPayload): void {
        if (!this.validatePlayer(client, payload.winnerId) || !this.validatePlayer(client, payload.loserId)) {
            return;
        }

        const [updatedPayload, battleValid, isGameOver] = this.currentGamesService.battleWon(client.rooms[0], payload);

        if(battleValid) {
            this.server.emit('handleBattleWon', updatedPayload);
            this.logger.log(`Player ${payload.winnerId} has won the battle against ${payload.loserId}`);
            
            if (isGameOver) {
                this.server.to(client.rooms[0]).emit('gameOver', { winnerId: payload.winnerId });
            }
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
        this.logger.log(`Player ${player.name} added to current game in room ${room}`);
        client.emit('joinCurrentGameResult', { success: true });
        this.emitJoinableGames();
    }

    @SubscribeMessage('getUnavailableAvatars')
    handleGetUnavailableAvatars(client: Socket): void {
        const room = getRoomIdFromSocket(client);
        if (room) {
            const avatars = this.currentGamesService.getUnavailableAvatars(room);
            client.emit('unavailableAvatars', avatars);
        }else{
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
}
