import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-fraud-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fraud-alerts.html',
  styleUrl: './fraud-alerts.css'
})
export class FraudAlerts implements OnInit {

  alerts: any[] = [];
  loading = false;

  page = 1;
  limit = 10;
  total = 0;

  ruleFilter = '';
  cardFilter = '';

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts() {
    this.loading = true;

    const params: any = {
      page: this.page,
      limit: this.limit
    };

    if (this.ruleFilter) {
      params.ruleType = this.ruleFilter;
    }

    if (this.cardFilter) {
      params.cardHash = this.cardFilter;
    }

    this.api.getFraudAlerts(params).subscribe({
      next: (res) => {
        this.alerts = res.data || [];
        this.total = res.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Fraud alerts error:', err);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.page = 1;
    this.loadAlerts();
  }

  changePage(newPage: number) {
    this.page = newPage;
    this.loadAlerts();
  }
}