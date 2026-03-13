import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api';

const RULE_DESCRIPTIONS: Record<string, string> = {
  VELOCITY_V1:
    'Flags a card when the number of transactions in the time window exceeds the threshold. Used to detect rapid or suspicious transaction volume.',
  HIGH_AMOUNT_V1:
    'Flags a transaction when the amount is above the threshold. Used to catch unusually large purchases.',
  RAPID_FAILURE_V1:
    'Flags a card when failed transaction attempts in the window reach the threshold. Used to detect testing or brute-force behavior.',
  SUSPICIOUS_HOURS_V1:
    'Flags any transaction that occurs between the configured start and end hour in Indian Standard Time (IST, 0–23). Use for high-risk windows (e.g. late night). Overnight ranges supported (e.g. 22 to 6).',
    MERCHANT_VELOCITY_V1:
    'Flags a merchant when the number of transactions in the time window exceeds the threshold. Useful for spotting compromised or abused merchants seeing sudden traffic spikes.',
};

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
  readonly ruleDescriptions = RULE_DESCRIPTIONS;

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

    const payload: Record<string, unknown> = {
      threshold: rule.threshold,
      severity: rule.severity,
      window_seconds: rule.window_seconds
    };
    if (rule.rule_type === 'SUSPICIOUS_HOURS_V1') {
      payload['start_hour'] = rule.start_hour;
      payload['end_hour'] = rule.end_hour;
    }

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