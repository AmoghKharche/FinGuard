import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css'
})
export class Transactions implements OnInit {

  transactions: any[] = [];
  loading = false;

  page = 1;
  limit = 10;
  total = 0;

  decisionFilter = '';

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions() {
    this.loading = true;

    const params: any = {
      page: this.page,
      limit: this.limit
    };

    if (this.decisionFilter) {
      params.decision = this.decisionFilter;
    }

    this.api.getTransactions(params).subscribe({
      next: (res) => {
        this.transactions = res.data;
        this.total = res.total;
        this.loading = false;
        this.cdr.detectChanges()
      },
      error: (err) => {
        console.error('Error:', err);
        this.loading = false;
      }
    });

  }

  changePage(newPage: number) {
    this.page = newPage;
    this.loadTransactions();
  }

  applyFilter(decision: string) {
    this.decisionFilter = decision;
    this.page = 1;
    this.loadTransactions();
  }
}