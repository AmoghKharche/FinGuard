import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard'
import { Transactions } from './pages/transactions/transactions';
import { FraudAlerts } from './pages/fraud-alerts/fraud-alerts';
import { Rules } from './pages/rules/rules';
import { Dlq } from './pages/dlq/dlq';

export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'transactions', component: Transactions },
  { path: 'fraud-alerts', component: FraudAlerts },
  { path: 'rules', component: Rules },
  { path: 'dlq', component: Dlq },
];