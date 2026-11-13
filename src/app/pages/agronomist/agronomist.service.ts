import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Agronomist,
  AreaMarker,
  FarmerRow,
  Kpis,
  LogRow,
  Rule,
  RuleType,
} from './agronomist.models';

interface LoginResponse { token: string; agronomist: Agronomist; }

/** All agronomist-dashboard calls to the live backend (`/api/agronomist/*`). */
@Injectable({ providedIn: 'root' })
export class AgronomistService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/agronomist`;

  login(code: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, { code });
  }

  kpis(): Observable<Kpis> {
    return this.http.get<Kpis>(`${this.base}/kpis`);
  }

  requests(): Observable<FarmerRow[]> {
    return this.http.get<FarmerRow[]>(`${this.base}/requests`);
  }

  review(
    id: string,
    body: { decision: 'approve' | 'adjust'; note: string; testFirst: boolean },
  ): Observable<{ id: string; reviewed: boolean }> {
    return this.http.post<{ id: string; reviewed: boolean }>(`${this.base}/requests/${id}/review`, body);
  }

  area(lat: number, lon: number, radiusKm = 25): Observable<AreaMarker[]> {
    return this.http.get<AreaMarker[]>(`${this.base}/area`, { params: { lat, lon, radiusKm } });
  }

  rules(): Observable<Rule[]> {
    return this.http.get<Rule[]>(`${this.base}/rules`);
  }
  addRule(text: string, type: RuleType): Observable<Rule> {
    return this.http.post<Rule>(`${this.base}/rules`, { text, type });
  }
  patchRule(id: string, active: boolean): Observable<Rule> {
    return this.http.patch<Rule>(`${this.base}/rules/${id}`, { active });
  }
  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rules/${id}`);
  }

  seasonLog(): Observable<LogRow[]> {
    return this.http.get<LogRow[]>(`${this.base}/season-log`);
  }
  addLog(body: { farmer: string; triedWindow: boolean; outcome: string }): Observable<LogRow> {
    return this.http.post<LogRow>(`${this.base}/season-log`, body);
  }
}
