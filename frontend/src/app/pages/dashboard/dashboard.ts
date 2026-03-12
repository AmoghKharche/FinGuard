import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { ChartConfiguration, ChartType } from 'chart.js';

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

  private socket!: WebSocket;

  metrics = {
    transactionsProcessed: 0,
    transactionsApproved: 0,
    transactionsReview: 0,
    transactionsDeclined: 0,
    fraudAlertsByRule: {},
    retryTotal: 0,
    dlqTotal: 0,
    workerErrors: 0
  };

  pieChartType: ChartType = 'pie';
  pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Approved', 'Review', 'Declined'],
    datasets: [{ data: [0, 0, 0] }]
  };

  barChartType: ChartType = 'bar';
  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ label: 'Fraud Alerts', data: [] }]
  };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadInitialMetrics();
    this.connectWebSocket();
  }

  // 🔹 Initial load (fallback)
  loadInitialMetrics() {
    this.api.getMetrics().subscribe(res => {
      if (res?.data) {
        this.updateMetrics(res.data);
      }
    });
  }

  // 🔹 WebSocket
  connectWebSocket() {
    this.socket = new WebSocket('ws://localhost:4000/ws/metrics');

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'metrics_update') {
        this.updateMetrics(message.data);
      }
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  // 🔹 SINGLE SOURCE OF TRUTH
  updateMetrics(metricsData: any) {

    this.metrics = { ...metricsData };

    this.pieChartData = {
      labels: ['Approved', 'Review', 'Declined'],
      datasets: [{
        data: [
          metricsData.transactionsApproved || 0,
          metricsData.transactionsReview || 0,
          metricsData.transactionsDeclined || 0
        ]
      }]
    };

    const rules = Object.keys(metricsData.fraudAlertsByRule || {});
    const values = Object.values(metricsData.fraudAlertsByRule || {});

    this.barChartData = {
      labels: rules.length ? rules : ['No Fraud'],
      datasets: [{
        label: 'Fraud Alerts',
        data: rules.length ? values as number[] : [0]
      }]
    };
    this.cdr.detectChanges();
  }
}