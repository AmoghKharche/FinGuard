import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dlq } from './dlq';

describe('Dlq', () => {
  let component: Dlq;
  let fixture: ComponentFixture<Dlq>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dlq],
    }).compileComponents();

    fixture = TestBed.createComponent(Dlq);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
