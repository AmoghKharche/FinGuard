import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { buildScenarios, TransactionEventPayload, TransactionScenario, TransactionStatus } from './scenarios';
import { ApiService } from '../../core/services/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-transaction-simulator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-simulator-modal.html',
  styleUrl: './transaction-simulator-modal.css'
})
export class TransactionSimulatorModal {

  private _open = false;

  @Input()
  get open(): boolean {
    return this._open;
  }

  set open(value: boolean) {
    this._open = value;
    this.openChange.emit(this._open);
  }

  @Output() openChange = new EventEmitter<boolean>();

  @Input() ruleConfig: any;

  scenarios: TransactionScenario[] = [];
  selectedScenario: TransactionScenario | null = null;

  mode: 'preset' | 'advanced' = 'preset';

  form: TransactionEventPayload = {
    merchantId: '',
    transactionId: '',
    amount: 100,
    status: 'APPROVED',
    cardHash: '',
    timestamp: ''
  };

  isPosting = false;
  lastResultMessage = '';
  constructor(private api: ApiService, private router: Router) {}
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['ruleConfig']) {
      const cfg = this.ruleConfig || {};
      this.scenarios = buildScenarios(cfg);
      this.selectedScenario = this.scenarios[0] ?? null;
      if (this.selectedScenario) {
        this.applyScenarioToForm(this.selectedScenario);
      }
    }
  }

  close() {
    this._open = false;
    this.openChange.emit(false);
  }

  selectScenario(scenario: TransactionScenario) {
    this.selectedScenario = scenario;
    if (this.mode === 'preset') {
      this.applyScenarioToForm(scenario);
    }
  }

  setMode(mode: 'preset' | 'advanced') {
    this.mode = mode;
    if (mode === 'preset' && this.selectedScenario) {
      this.applyScenarioToForm(this.selectedScenario);
    }
  }

  private applyScenarioToForm(scenario: TransactionScenario) {
    const [first] = scenario.generateEvents();
    if (!first) return;
    this.form = {
      merchantId: first.merchantId,
      transactionId: first.transactionId,
      amount: first.amount,
      status: first.status,
      cardHash: first.cardHash,
      timestamp: first.timestamp
    };
  }

  statusOptions: TransactionStatus[] = ['APPROVED', 'FAILED'];

  async submit() {
    if (this.isPosting) return;
    this.isPosting = true;
    this.lastResultMessage = '';

    try {
      const events: TransactionEventPayload[] =
        this.mode === 'preset' && this.selectedScenario
          ? this.selectedScenario.generateEvents()
          : [{ ...this.form }];

      for (const ev of events) {
        await this.api.simulateTransaction(ev).toPromise();
      }

      this.lastResultMessage = events.length === 1
        ? 'Simulated transaction sent. Check Transactions, Dashboard, and Fraud Alerts for the result.'
        : `${events.length} simulated transactions sent. Watch Transactions, Dashboard, and Fraud Alerts as they process.`;
    } catch (e) {
      this.lastResultMessage = 'Something went wrong posting the simulated transaction. Please try again.';
    } finally {
      this.isPosting = false;
    }
  }

  goToTransactions() {
    this.close();
    this.router.navigate(['/transactions']);
  }
}

