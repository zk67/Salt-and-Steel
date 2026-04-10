import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameLobbyService } from '@app/gateways/services/current-game-lobby.service';
import { CurrentGamePlayService } from '@app/gateways/services/current-game-play.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import { DebugMovePayload, MovePlayerPayload, ActiveCombatPayload, ActionOnTilePayload,
        SubmitCombatPosturePayload, PassFlagPayload, ToggleDebugPayload, UpdateFlagPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly broadcastService: CurrentGameBroadcastService,
        private readonly lobbyService: CurrentGameLobbyService,
        private readonly playService: CurrentGamePlayService,
    ) {}

    afterInit(): void {
        this.broadcastService.setServer(this.server);
        this.playService.bindTurnEmitter();
    }

    @SubscribeMessage(GatewayEvents.MovePlayer)
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        this.playService.handleMovePlayer(client, payload);
    }

    @SubscribeMessage(GatewayEvents.StartGame)
    startGame(client: Socket): void {
        this.playService.startGame(client);
    }

    @SubscribeMessage(GatewayEvents.CreateGame)
    async createGame(client: Socket, data: { gameDbId: string; gameId: string }): Promise<boolean> {
        return this.lobbyService.createGame(client, data);
    }

    @SubscribeMessage(GatewayEvents.GetPlayersToGame)
    getPlayersToGame(client: Socket): void {
        this.lobbyService.getPlayersToGame(client);
    }

    @SubscribeMessage(GatewayEvents.GetJoinableGames)
    handleGetJoinableGames(client: Socket): void {
        this.lobbyService.emitJoinableGamesToClient(client);
    }

    @SubscribeMessage(GatewayEvents.EndTurnEarly)
    endTurnEarly(client: Socket): void {
        this.playService.endTurnEarly(client);
    }

    @SubscribeMessage(GatewayEvents.DebugMove)
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.playService.handleDebugMove(client, payload);
    }

    @SubscribeMessage(GatewayEvents.Surrender)
    handleSurrender(client: Socket): void {
        this.lobbyService.handleSurrender(client);
    }

    @SubscribeMessage(GatewayEvents.KickPlayer)
    handleKickPlayer(client: Socket, payload: { playerId: string }): void {
        this.lobbyService.handleKickPlayer(client, payload);
    }

    @SubscribeMessage(GatewayEvents.AddPlayerToCurrentGame)
    handleAddPlayerToCurrentGame(client: Socket, player: Player): void {
        this.lobbyService.handleAddPlayerToCurrentGame(client, player);
    }

    @SubscribeMessage(GatewayEvents.GetUnavailableAvatars)
    handleGetUnavailableAvatars(client: Socket): void {
        this.lobbyService.handleGetUnavailableAvatars(client);
    }

    @SubscribeMessage(GatewayEvents.SelectAvatarInJoinForm)
    handleSelectAvatarInJoinForm(client: Socket, avatar: string): void {
        this.lobbyService.handleSelectAvatarInJoinForm(client, avatar);
    }

    @SubscribeMessage(GatewayEvents.ClearSelectedAvatarInJoinForm)
    handleClearSelectedAvatarInJoinForm(client: Socket): void {
        this.lobbyService.handleClearSelectedAvatarInJoinForm(client);
    }

    @SubscribeMessage(GatewayEvents.ToggleDebugMode)
    handleToggleDebugMode(client: Socket, payload: ToggleDebugPayload): void {
        this.playService.handleToggleDebugMode(client, payload);
    }

    @SubscribeMessage(GatewayEvents.ActionOnTile)
    handleActionOnTile(client: Socket, payload: ActionOnTilePayload): void {
        payload.playerId = client.id;
        this.playService.handleActionOnTile(client, payload);
    }

    @SubscribeMessage(GatewayEvents.StartCombat)
    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        this.playService.handleStartCombat(client, payload);
    }

    @SubscribeMessage(GatewayEvents.SubmitCombatPosture)
    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        this.playService.handleSubmitCombatPosture(client, payload);
    }

    @SubscribeMessage(GatewayEvents.PassFlag)
    handlePassFlag(client: Socket, payload: PassFlagPayload): void {
        if (this.playService.handlePassFlag(client, payload)) {
            this.broadcastService.emitHandlePassFlag(getRoomIdFromSocket(client), payload);
        }
    }

    @SubscribeMessage(GatewayEvents.UpdateFlag)
    handleUpdateFlag(client: Socket, payload: UpdateFlagPayload): void {
        if (this.playService.handleUpdateFlag(client, payload)) {
            this.broadcastService.emitUpdateFlag(getRoomIdFromSocket(client), payload);
        }
    }
}