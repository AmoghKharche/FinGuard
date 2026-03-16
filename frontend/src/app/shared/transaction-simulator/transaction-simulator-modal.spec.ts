import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionSimulatorModal } from './transaction-simulator-modal';
import { ApiService } from '../../core/services/api';
import { Router } from '@angular/router';
import { of } from 'rxjs';

class ApiServiceStub {
  simulateTransaction() {
    return of({});
  }
}

class RouterStub {
  navigate() {
    return Promise.resolve(true);
  }
}

describe('TransactionSimulatorModal', () => {
  let component: TransactionSimulatorModal;
  let fixture: ComponentFixture<TransactionSimulatorModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionSimulatorModal],
      providers: [
        { provide: ApiService, useClass: ApiServiceStub },
        { provide: Router, useClass: RouterStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionSimulatorModal);
    component = fixture.componentInstance;
    component.open = true;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render scenarios list', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const scenarioButtons = compiled.querySelectorAll('.fg-sim-scenario');
    expect(scenarioButtons.length).toBeGreaterThan(0);
  });
});

