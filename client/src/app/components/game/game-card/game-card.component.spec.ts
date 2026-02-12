import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Game } from '@common/types/game.interface';
import { GameCardComponent } from './game-card.component';

/*
Stratégie de tests:
- Le Router est mocké afin d’isoler le composant et vérifier les navigations.
- Les tests valident l’affichage conditionnel de l’image et la gestion du clic.
Cas limite testé :
- Absence d’image (imageUrl vide) afin de vérifier l’affichage du texte
  de remplacement et éviter une erreur d’affichage.
*/

describe('GameCardComponent', () => {
    let component: GameCardComponent;
    let fixture: ComponentFixture<GameCardComponent>;
    let routerSpy: jasmine.SpyObj<Router>;

    const mockGameWithImage = {
        _id: '1',
        name: 'Test Game',
        description: 'Description',
        imageUrl: 'http://image.png',
        maxPlayers: 4,
        minPlayers: 2,
        visible: true,
    } as Game;

    const mockGameWithoutImage = {
        _id: '2',
        name: 'No Image Game',
        description: 'Description',
        imageUrl: '',
        maxPlayers: 6,
        minPlayers: 1,
        visible: true,
    } as Game;

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [GameCardComponent],
            providers: [{ provide: Router, useValue: routerSpy }],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCardComponent);
        component = fixture.componentInstance;
    });

    it('devrait naviguer vers le formulaire de personnage et émettre un événement de clic', () => {
        spyOn(component.click, 'emit');
        component.game = mockGameWithImage;

        component.handleClick();

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/character-form']);
    });

    it('devrait afficher l\'image lorsque imageUrl est présent', () => {
        component.game = mockGameWithImage;
        fixture.detectChanges();

        const img = fixture.debugElement.query(By.css('img'));
        expect(img).toBeTruthy();
        expect(img.nativeElement.src).toContain('image.png');
    });

    it('devrait afficher le texte de remplacement lorsque imageUrl est absent', () => {
        component.game = mockGameWithoutImage;
        fixture.detectChanges();

        const placeholder = fixture.debugElement.query(By.css('p'));
        expect(placeholder).toBeTruthy();
        expect(placeholder.nativeElement.textContent).toContain('image');
    });

    it('devrait appeler handleClick lorsque la carte est cliquée', () => {
        component.game = mockGameWithImage;
        spyOn(component, 'handleClick');

        fixture.detectChanges();
        fixture.debugElement.query(By.css('.game-card')).triggerEventHandler('click');
        expect(component.handleClick).toHaveBeenCalled();
    });
});
