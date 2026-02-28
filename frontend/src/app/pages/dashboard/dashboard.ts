import { Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { ChartConfiguration, ChartType } from 'chart.js';
import { ChangeDetectorRef } from '@angular/core';

import {
  Chart,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PieController,
  BarController,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PieController,
  BarController,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

  pieChartType: ChartType = 'pie';
  pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Approved', 'Review', 'Declined'],
    datasets: [{
      data: [0, 0, 0]
    }]
  };

  barChartType: ChartType = 'bar';
  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Fraud Alerts',
      data: []
    }]
  };
  metrics:any;
  // metrics = {
  //   transactionsProcessed: 0,
  //   transactionsApproved: 0,
  //   transactionsReview: 0,
  //   transactionsDeclined: 0,
  //   fraudAlertsByRule: {},
  //   retryTotal: 0,
  //   dlqTotal: 0,
  //   workerErrors: 0
  // };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
      this.loadMetrics();
  }

  loadMetrics() {
    this.api.getMetrics().subscribe((res) => {
  
      this.metrics = res?.data;
      if (!this.metrics) return;

      // 🔥 Replace PIE chart completely
      this.pieChartData = {
        labels: ['Approved', 'Review', 'Declined'],
        datasets: [{
          data: [
            this.metrics.transactionsApproved || 0,
            this.metrics.transactionsReview || 0,
            this.metrics.transactionsDeclined || 0
          ]
        }]
      };
  
      // 🔥 Replace BAR chart completely (NO mutation)
      const rules = Object.keys(this.metrics.fraudAlertsByRule || {});
      const values = Object.values(this.metrics.fraudAlertsByRule || {});
  
      this.barChartData = {
        labels: rules.length ? rules : ['No Fraud'],
        datasets: [{
          label: 'Fraud Alerts',
          data: rules.length ? values as number[] : [0]
        }]
      };
      this.cdr.detectChanges();
  
    });
  }
}