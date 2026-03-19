import { Injectable } from '@angular/core';
import { GatewayEvents } from '@common/types/gateway.events';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class SocketClientService {
    private socket: Socket;

    isSocketAlive(): boolean {
        return this.socket && this.socket.connected;
    }

    connect(): void {
        this.socket = io(environment.socketUrl, { transports: ['websocket'], upgrade: false });
    }

    disconnect(): void {
        this.socket.disconnect();
    }

    on<T>(event: GatewayEvents, action: (data: T) => void): void {
        this.socket.on(event, action);
    }

    off<T>(event: GatewayEvents, action: (data: T) => void): void {
        this.socket.off(event, action);
    }

    send<T>(event: GatewayEvents, data?: T, callback?: () => void): void {
        this.socket.emit(event, ...([data, callback].filter((x) => x)));
    }

    joinRoom(room: string): void {
        this.socket.emit(GatewayEvents.JoinRoom, room);
    }

    leaveRoom(room: string): void {
        this.socket.emit(GatewayEvents.LeaveRoom, room);
    }

    sendMessage(content: string): void {
        this.socket.emit(GatewayEvents.SendMessage, { content });
    }
}
