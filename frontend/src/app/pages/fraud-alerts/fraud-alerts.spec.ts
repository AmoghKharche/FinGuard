import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FraudAlerts } from './fraud-alerts';

describe('FraudAlerts', () => {
  let component: FraudAlerts;
  let fixture: ComponentFixture<FraudAlerts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FraudAlerts],
    }).compileComponents();

    fixture = TestBed.createComponent(FraudAlerts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
