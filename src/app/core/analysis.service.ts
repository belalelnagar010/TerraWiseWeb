import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { AnalysisRequest, AnalysisResponse } from './models';

/**
 * Talks to the TerraWise analysis backend.
 *
 * The real implementation will POST {@link AnalysisRequest} to `/api/analyze`.
 * For now it returns the agreed mock shape after a 1500ms delay and caches the
 * latest result in {@link lastResult} so the results page can read it (and the
 * guard can allow navigation). The HTTP wiring is prepared but not fired.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  // When the backend is live, inject HttpClient and swap the body of analyze().
  // constructor(private http: HttpClient) {}
  private readonly endpoint = '/api/analyze';

  /** Most recent analysis response (null until the first analyze() completes). */
  readonly lastResult = signal<AnalysisResponse | null>(null);

  analyze(req: AnalysisRequest): Observable<AnalysisResponse> {
    // === REAL CALL (prepared, not fired) ===
    // return this.http.post<AnalysisResponse>(this.endpoint, req).pipe(
    //   tap((r) => this.lastResult.set(r)),
    // );

    return of(this.buildMock(req)).pipe(
      delay(1500),
      tap((r) => this.lastResult.set(r)),
    );
  }

  /** Agreed mock shape — backend will replace it verbatim. */
  private buildMock(_req: AnalysisRequest): AnalysisResponse {
    return {
      window: { start: '2026-11-16', end: '2026-11-29', usualStart: '2026-12-01', shiftDays: 11 },
      calendar: [
        { month: 1, status: 'out' },
        { month: 2, status: 'safe' },
        { month: 3, status: 'optimal' },
        { month: 4, status: 'flowering' },
        { month: 5, status: 'flowering' },
        { month: 6, status: 'out' },
        { month: 7, status: 'heat' },
        { month: 8, status: 'heat' },
        { month: 9, status: 'out' },
        { month: 10, status: 'out' },
        { month: 11, status: 'out' },
        { month: 12, status: 'out' },
      ],
      irrigation: [
        { month: 1, need: 'none' },
        { month: 2, need: 'low' },
        { month: 3, need: 'low' },
        { month: 4, need: 'high' },
        { month: 5, need: 'high' },
        { month: 6, need: 'high' },
        { month: 7, need: 'high' },
        { month: 8, need: 'low' },
        { month: 9, need: 'none' },
        { month: 10, need: 'none' },
        { month: 11, need: 'none' },
        { month: 12, need: 'none' },
      ],
      timeMachine: [
        { year: 2001, windowStartDay: 5 },
        { year: 2005, windowStartDay: 7 },
        { year: 2010, windowStartDay: 9 },
        { year: 2015, windowStartDay: 11 },
        { year: 2020, windowStartDay: 14 },
        { year: 2025, windowStartDay: 16 },
        { year: 2050, windowStartDay: 27 },
      ],
      evidence: {
        why: 'Flowering avoids April heat waves and grain-fill ends before peak summer heat.',
        nasaSource: 'NASA POWER · 1981–2025',
        confidence: 'high',
      },
    };
  }
}
