import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SaveService } from '@app/services/save/save.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Game } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { of } from 'rxjs';
import { GameCreationPageComponent } from './game-creation-page.component';

/*
Stratégie de tests:
- Les services (SaveService et SocketClientService) sont mockés afin
  d’isoler le composant et contrôler les appels effectués.
- Les services sont mockés afin d’isoler le composant et contrôler les appels effectués.
- Les tests vérifient le chargement initial des jeux ainsi que la gestion
  des événements socket (enregistrement, désenregistrement et rafraîchissement).
*/

describe('GameCreationPageComponent', () => {
    let component: GameCreationPageComponent;
    let fixture: ComponentFixture<GameCreationPageComponent>;
    let saveServiceSpy: jasmine.SpyObj<SaveService>;
    let socketServiceSpy: jasmine.SpyObj<SocketClientService>;

    const mockGames: Game[] = [
        { _id: '1', name: 'Visible Game', description: 'A visible game', visible: true } as Game,
        { _id: '2', name: 'Hidden Game', description: 'A hidden game', visible: false } as Game,
    ];

    beforeEach(async () => {
        saveServiceSpy = jasmine.createSpyObj<SaveService>('SaveService', [
            'getAllGames',
            'getAllVisibleGames',
        ]);

        socketServiceSpy = jasmine.createSpyObj<SocketClientService>('SocketClientService', [
            'on',
            'off',
        ]);

        saveServiceSpy.getAllGames.and.returnValue(of(mockGames));
        saveServiceSpy.getAllVisibleGames.and.returnValue(of(mockGames));

        await TestBed.configureTestingModule({
            imports: [GameCreationPageComponent],
            providers: [
                provideRouter([]),
                { provide: SaveService, useValue: saveServiceSpy },
                { provide: SocketClientService, useValue: socketServiceSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('devrait afficher tous les jeux', () => {
        expect(saveServiceSpy.getAllVisibleGames).toHaveBeenCalled();
        expect(component.games).toEqual(mockGames);
    });

    it('devrait enregistrer l\'écouteur de mise à jour socket', () => {
        expect(socketServiceSpy.on).toHaveBeenCalledWith(GatewayEvents.Update, jasmine.any(Function));
    });

    it('devrait désenregistrer l\'écouteur de mise à jour socket lors de la destruction du composant', () => {
        component.ngOnDestroy();
        expect(socketServiceSpy.off).toHaveBeenCalledWith(
            GatewayEvents.Update,
            jasmine.any(Function),
        );
    });

    it('devrait rafraîchir les jeux lorsque l\'événement de mise à jour socket est déclenché', () => {
        const getAllGamesSpy = spyOn(component, 'getAllGames');
        const refreshCallback = socketServiceSpy.on.calls.mostRecent().args[1];
        refreshCallback(null);
        expect(getAllGamesSpy).toHaveBeenCalled();
    });
});
