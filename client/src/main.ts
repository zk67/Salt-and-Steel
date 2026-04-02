import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { CharacterPageComponent } from '@app/pages/character-page/character-page.component';
import { EditionPageComponent } from '@app/pages/edition-page/edition-page.component';
import { FormEditionPageComponent } from '@app/pages/form-edition-page/form-edition-page.component';
import { GameCreationPageComponent } from '@app/pages/game-creation-page/game-creation-page.component';
import { GamePageComponent } from '@app/pages/game-page/game-page.component';
import { JoinGameComponent } from '@app/pages/join-game-page/join-game-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { StatisticsPageComponent } from '@app/pages/statistics-page/statistics-page.component';
import { WaitingPageComponent } from '@app/pages/waiting-page/waiting-page.component';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: APP_ROUTES.home, pathMatch: 'full' },
    { path: 'home', component: MainPageComponent },
    { path: 'game-creation', component: GameCreationPageComponent },
    { path: 'form-edition', component: FormEditionPageComponent },
    { path: 'edition', component: EditionPageComponent },
    { path: 'character-form', component: CharacterPageComponent },
    { path: 'waiting', component: WaitingPageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'game', component: GamePageComponent },
    { path: 'join-game', component: JoinGameComponent },
    { path: 'statistics', component: StatisticsPageComponent },
    { path: '**', redirectTo: APP_ROUTES.home },
];

bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});
