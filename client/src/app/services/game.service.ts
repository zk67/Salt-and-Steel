import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@common/classes/game';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    private readonly baseUrl: string = environment.serverUrl;

    constructor(private readonly http: HttpClient) {}

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games`).pipe(catchError(this.handleError<Game[]>('getAllGames')));
    }

    addGame(game: Game): Observable<Game> {
        return this.http.post<Game>(`${this.baseUrl}/games`, game).pipe(catchError(this.handleError<Game>('addGame')));
    }

    updateGame(_id: string, game: Game): Observable<Game> {
        return this.http.put<Game>(`${this.baseUrl}/games/${_id}`, game).pipe(catchError(this.handleError<Game>('addGame')));
    }

    deleteGame(_id: string): Observable<Game> {
        return this.http.delete<Game>(`${this.baseUrl}/games/${_id}`).pipe(catchError(this.handleError<Game>('deleteGame')));
    }

    getGame(_id: string): Observable<Game> {
        return this.http.get<Game>(`${this.baseUrl}/games/${_id}`).pipe(catchError(this.handleError<Game>('getGame')));
    }

    patchGame(_id: string, visibility: boolean): Observable<Game> {
        return this.http.patch<Game>(`${this.baseUrl}/games/${_id}`, { visible: visibility }).pipe(catchError(this.handleError<Game>('patchGame')));
    }

    private handleError<T>(request: string, result?: T): (error: Error) => Observable<T> {
        return () => of(result as T);
    }
}
