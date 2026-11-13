import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AnalysisRequest, AnalysisResponse } from './models';

/**
 * Talks to the TerraWise analysis backend.
 *
 * The real implementation will POST {@link AnalysisRequest} to `/api/analyze`.
 * For now it returns deterministic mock data after a 1500ms delay so the UI
 * can be built and demoed end-to-end. The HTTP wiring is prepared below but
 * intentionally not fired yet.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  // When the backend is live, inject HttpClient and swap the body of analyze().
  // constructor(private http: HttpClient) {}
  private readonly endpoint = '/api/analyze';

  analyze(req: AnalysisRequest): Observable<AnalysisResponse> {
    // === REAL CALL (prepared, not fired) ===
    // return this.http.post<AnalysisResponse>(this.endpoint, req);

    return of(this.buildMock(req)).pipe(delay(1500));
  }

  /** Builds a plausible, request-aware mock response. */
  private buildMock(req: AnalysisRequest): AnalysisResponse {
    const usualMonth = req.usualPlantMonth || 11;
    // Optimal window nudges a week or two earlier than the usual date.
    const shiftDays = -9;
    const usualStart = this.isoForMonth(usualMonth, 2026);
    const start = this.addDays(usualStart, shiftDays);
    const end = this.addDays(start, 18);

    return {
      window: { start, end, usualStart, shiftDays },
      calendar: [
        { month: 1, status: 'frost' },
        { month: 2, status: 'safe' },
        { month: 3, status: 'optimal' },
        { month: 4, status: 'flowering' },
        { month: 5, status: 'heat' },
        { month: 6, status: 'out' },
        { month: 7, status: 'out' },
        { month: 8, status: 'out' },
        { month: 9, status: 'safe' },
        { month: 10, status: 'optimal' },
        { month: 11, status: 'optimal' },
        { month: 12, status: 'safe' },
      ],
      irrigation: [
        { month: 1, need: 'none' }, { month: 2, need: 'low' },
        { month: 3, need: 'low' }, { month: 4, need: 'high' },
        { month: 5, need: 'high' }, { month: 6, need: 'high' },
        { month: 7, need: 'high' }, { month: 8, need: 'high' },
        { month: 9, need: 'low' }, { month: 10, need: 'low' },
        { month: 11, need: 'none' }, { month: 12, need: 'none' },
      ],
      timeMachine: Array.from({ length: 45 }, (_, i) => ({
        year: 1981 + i,
        windowStartDay: 300 + Math.round(Math.sin(i / 3) * 10 + (i > 30 ? -i / 4 : 0)),
      })),
      evidence: {
        why:
          `For ${req.crop || 'your crop'} at ${req.lat.toFixed(2)}, ${req.lon.toFixed(2)}, ` +
          `planting ~${Math.abs(shiftDays)} days earlier avoids the late-season heat spike ` +
          `while staying clear of early frost risk.`,
        nasaSource: 'NASA POWER daily climatology (1981–2025) · MODIS NDVI · SoilGrids',
        confidence: 'high',
      },
    };
  }

  private isoForMonth(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, '0')}-15`;
  }

  private addDays(iso: string, days: number): string {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
