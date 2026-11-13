import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AnalysisRequest, AnalysisResponse } from './models';

/**
 * Talks to the live TerraWise backend.
 *
 * `analyze()` posts {@link AnalysisRequest} to `POST ${apiBaseUrl}/analyze` and
 * returns the {@link AnalysisResponse}. The latest request and result are cached
 * ({@link lastRequest} / {@link lastResult}) so the results page can read them
 * (for display and for the PDF export) and the route guard can allow navigation.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  readonly lastResult = signal<AnalysisResponse | null>(null);
  readonly lastRequest = signal<AnalysisRequest | null>(null);

  analyze(req: AnalysisRequest): Observable<AnalysisResponse> {
    this.lastRequest.set(req);
    return this.http
      .post<AnalysisResponse>(`${this.base}/analyze`, req)
      .pipe(tap((r) => this.lastResult.set(r)));
  }

  /** Requests the server-rendered PDF report for a request as a binary blob. */
  pdf(req: AnalysisRequest): Observable<Blob> {
    return this.http.post(`${this.base}/results/pdf`, req, { responseType: 'blob' });
  }
}
