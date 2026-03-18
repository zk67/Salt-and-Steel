import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketClientService {
    private socket: Socket;

    isSocketAlive(): boolean {
        return this.socket && this.socket.connected;
    }

    connect(): void {
        //changer le lien selon si je teste localement ou en ligne.
        this.socket = io(environment.socketUrl, { transports: ['websocket'], upgrade: false });
    }

    disconnect(): void {
        this.socket.disconnect();
    }

    on<T>(event: string, action: (data: T) => void): void {
        this.socket.on(event, action);
    }

    off<T>(event: string, action: (data: T) => void): void {
        this.socket.off(event, action);
    }

    send<T>(event: string, data?: T, callback?: () => void): void {
        this.socket.emit(event, ...([data, callback].filter((x) => x)));
    }

    joinRoom(room: string): void {
        this.socket.emit('joinRoom', room);
    }

    leaveRoom(room: string): void {
        this.socket.emit('leaveRoom', room);
    }

    sendMessage(content: string): void {
        this.socket.emit('sendMessage', { content });
    }
}
