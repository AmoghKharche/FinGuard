import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-dlq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dlq.html',
  styleUrl: './dlq.css'
})
export class Dlq implements OnInit {

  dlqItems: any[] = [];
  loading = false;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadDLQ();
  }

  loadDLQ() {
    this.loading = true;

    this.api.getDLQ().subscribe({
      next: (res) => {
        this.dlqItems = res.data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('DLQ error:', err);
        this.loading = false;
      }
    });
  }

  toggleExpand(item: any) {
    item.expanded = !item.expanded;
  }
}