import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { TimeService } from './time.service';

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
});
