import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketClientService } from '@app/services/socket/socket-client.service';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
    constructor(private socketService: SocketClientService) {}
    ngOnInit(): void {
        this.socketService.connect();
    }
}
