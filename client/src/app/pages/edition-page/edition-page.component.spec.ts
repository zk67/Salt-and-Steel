import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayAreaComponent } from '@app/components/play-area/play-area.component';
import { EditionPageComponent } from './edition-page.component';

@Component({
    selector: 'app-sidebar',
})
class MockSidebarComponent {} // Retire la dépendance réelle au module de Routage

describe('GamePageComponent', () => {
    let component: EditionPageComponent;
    let fixture: ComponentFixture<EditionPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [EditionPageComponent],
        }).compileComponents();

        TestBed.overrideComponent(EditionPageComponent, {
            set: {
                imports: [MockSidebarComponent, PlayAreaComponent],
            },
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(EditionPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
