import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rules.html',
  styleUrl: './rules.css'
})
export class Rules implements OnInit {

  rules: any[] = [];
  loading = false;
  savingRule: string | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadRules();
  }

  loadRules() {
    this.loading = true;

    this.api.getRuleConfig().subscribe({
      next: (res) => {
        const ruleData = res.data || res;

        // Convert object to array for iteration
        this.rules = Object.values(ruleData);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Rules load error:', err);
        this.loading = false;
      }
    });
  }

  saveRule(rule: any) {
    this.savingRule = rule.rule_type;

    const payload = {
      threshold: rule.threshold,
      severity: rule.severity,
      window_seconds: rule.window_seconds
    };

    this.api.patchRule(rule.rule_type, payload).subscribe({
      next: () => {
        this.savingRule = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Rule update error:', err);
        this.savingRule = null;
      }
    });
  }
}