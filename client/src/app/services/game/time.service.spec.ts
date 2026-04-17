import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { TimeService } from './time.service';

/**
 * Description:
 * Ce fichier de tests verifie que TimeService gere correctement
 * le compte a rebours local, son arret et ses cas limites.
 *
 * Fonctionnement:
 * 1) On demarre le service avec des faux timers Angular pour simuler
 * l'ecoulement du temps sans attendre en temps reel.
 *
 * 2) On verifie ensuite la decrementation, la remise a zero,
 * l'absence de valeurs negatives et le fait qu'un timer actif
 * ne soit pas redemarre par erreur.
 */

const ONE_SECOND_MS = 1000;
const THREE_SECONDS = 3;
const TWO_SECONDS = 2;
const FIVE_SECONDS_MS = 5000;

describe('TimeService', () => {
    let service: TimeService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [TimeService],
        });

        service = TestBed.inject(TimeService);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('decremente le compteur chaque seconde', fakeAsync(() => {
        service.startTimer(THREE_SECONDS);

        tick(ONE_SECOND_MS);
        expect(service.time()).toBe(TWO_SECONDS);

        service.stopTimer();
    }));

    it('stopTimer remet le compteur a zero et annule le timer courant', fakeAsync(() => {
        service.startTimer(THREE_SECONDS);

        tick(ONE_SECOND_MS);
        expect(service.time()).toBe(TWO_SECONDS);

        service.stopTimer();
        expect(service.time()).toBe(0);

        tick(FIVE_SECONDS_MS);
        expect(service.time()).toBe(0);
    }));

    it('nira jamais en dessous de zero quand le compteur expire', fakeAsync(() => {
        service.startTimer(THREE_SECONDS);

        tick(THREE_SECONDS * ONE_SECOND_MS + FIVE_SECONDS_MS);

        expect(service.time()).toBe(0);
    }));

    it('ignore un second startTimer tant quun timer est deja actif', fakeAsync(() => {
        service.startTimer(THREE_SECONDS);
        service.startTimer(FIVE_SECONDS_MS);

        tick(ONE_SECOND_MS);

        expect(service.time()).toBe(TWO_SECONDS);
        service.stopTimer();
    }));
});
