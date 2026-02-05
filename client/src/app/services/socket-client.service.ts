import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketClientService {

  socket: Socket;

  isSocketAlive() {
    return this.socket && this.socket.connected;
  }

  connect() {
    this.socket = io(environment.socketUrl, { transports: ['websocket'], upgrade: false });
  }

  disconnect() {
    this.socket.disconnect();
  }

  on<T>(event: string, action: (data: T) => void): void {
    this.socket.on(event, action);
  }

  off<T>(event: string, action: (data: T) => void): void {
    this.socket.off(event, action);
  }

  send<T>(event: string, data?: T, callback?: () => void): void {
    this.socket.emit(event, ...([data, callback].filter(x => x)));
  }
}
