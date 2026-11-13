import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FieldMap } from './field-map';

describe('FieldMap', () => {
  let component: FieldMap;
  let fixture: ComponentFixture<FieldMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FieldMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
