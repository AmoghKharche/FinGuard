import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { ChartConfiguration } from 'chart.js';

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

const PIE_COLORS = {
  approved: 'rgba(34, 197, 94, 0.85)',
  review: 'rgba(245, 158, 11, 0.85)',
  declined: 'rgba(239, 68, 68, 0.85)'
};
const PIE_BORDER = { approved: '#22c55e', review: '#f59e0b', declined: '#ef4444' };

const BAR_COLORS = [
  'rgba(99, 102, 241, 0.9)', 'rgba(139, 92, 246, 0.9)', 'rgba(236, 72, 153, 0.9)',
  'rgba(249, 115, 22, 0.9)', 'rgba(34, 197, 94, 0.9)', 'rgba(6, 182, 212, 0.9)'
];
const BAR_BORDER = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4'];

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

  pieChartType = 'pie' as const;
  pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Approved', 'Review', 'Declined'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: [PIE_COLORS.approved, PIE_COLORS.review, PIE_COLORS.declined],
      borderColor: [PIE_BORDER.approved, PIE_BORDER.review, PIE_BORDER.declined],
      borderWidth: 2,
      hoverOffset: 6
    }]
  };

  pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 10, usePointStyle: true, font: { size: 11 }, color: '#334155' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total ? Math.round((ctx.raw as number) / total * 100) : 0;
            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
          }
        }
      }
    }
  };

  barChartType = 'bar' as const;
  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Alerts',
      data: [],
      backgroundColor: BAR_COLORS,
      borderColor: BAR_BORDER,
      borderWidth: 1
    }]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(15, 23, 42, 0.08)' },
        ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#64748b' }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#334155' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.x} alert${ctx.parsed.x === 1 ? '' : 's'}`
        }
      }
    }
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
        ],
        backgroundColor: [PIE_COLORS.approved, PIE_COLORS.review, PIE_COLORS.declined],
        borderColor: [PIE_BORDER.approved, PIE_BORDER.review, PIE_BORDER.declined],
        borderWidth: 2,
        hoverOffset: 6
      }]
    };

    const rules = Object.keys(metricsData.fraudAlertsByRule || {});
    const values = Object.values(metricsData.fraudAlertsByRule || {}) as number[];
    const n = Math.max(rules.length || 1, 1);
    const bgColors = rules.length ? [...Array(n)].map((_, i) => BAR_COLORS[i % BAR_COLORS.length]) : [BAR_COLORS[0]];
    const borderColors = rules.length ? [...Array(n)].map((_, i) => BAR_BORDER[i % BAR_BORDER.length]) : [BAR_BORDER[0]];

    this.barChartData = {
      labels: rules.length ? rules : ['No data'],
      datasets: [{
        label: 'Alerts',
        data: rules.length ? values : [0],
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1
      }]
    };
    this.cdr.detectChanges();
  }
}