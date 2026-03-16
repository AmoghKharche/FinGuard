import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dashboard } from './dashboard';
import { By } from '@angular/platform-browser';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show simulate transaction button', () => {
    fixture.detectChanges();
    const button = fixture.debugElement.query(
      By.css('button span')
    )?.nativeElement as HTMLSpanElement | null;
    expect(button?.textContent).toContain('Simulate a transaction');
  });
});
