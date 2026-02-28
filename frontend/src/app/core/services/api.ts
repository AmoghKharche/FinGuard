import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://localhost:4000';

  constructor(private http: HttpClient) {}

  getMetrics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/metrics`);
  }

  getTransactions(params: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/transactions`, { params });
  }

  getFraudAlerts(params: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/fraud-alerts`, { params });
  }

  getRuleConfig(): Observable<any> {
    return this.http.get(`${this.baseUrl}/rule-config`);
  }

  patchRule(ruleType: string, body: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/rule-config/${ruleType}`, body);
  }

  getDLQ(): Observable<any> {
    return this.http.get(`${this.baseUrl}/dlq`);
  }
}