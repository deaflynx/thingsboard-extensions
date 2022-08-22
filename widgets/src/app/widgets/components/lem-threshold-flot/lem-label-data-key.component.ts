///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormGroup,
  NG_VALUE_ACCESSOR, ValidationErrors,
  Validators
} from '@angular/forms';
import { PageComponent } from '@shared/public-api';
import { Store } from '@ngrx/store';
import { AppState } from '@core/public-api';
import { TranslateService } from '@ngx-translate/core';
import { DataKeyType } from '@shared/public-api';

export interface LabelDataKey {
  name: string;
  type: DataKeyType;
}

export function labelDataKeyValidator(control: AbstractControl): ValidationErrors | null {
  const labelDataKey: LabelDataKey = control.value;
  if (!labelDataKey || !labelDataKey.name) {
    return {
      labelDataKey: true
    };
  }
  return null;
}

@Component({
  selector: 'tb-label-data-key',
  templateUrl: './lem-label-data-key.component.html',
  styleUrls: ['./lem-label-data-key.component.scss', './widget-settings.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LemLabelDataKeyComponent),
      multi: true
    }
  ]
})
export class LemLabelDataKeyComponent extends PageComponent implements OnInit, ControlValueAccessor {

  @Input()
  disabled: boolean;

  @Input()
  expanded = false;

  @Output()
  removeLabelDataKey = new EventEmitter();

  private modelValue: LabelDataKey;

  private propagateChange = null;

  public labelDataKeyFormGroup: FormGroup;

  constructor(protected store: Store<AppState>,
              private translate: TranslateService,
              private fb: FormBuilder) {
    super(store);
  }

  ngOnInit(): void {
    this.labelDataKeyFormGroup = this.fb.group({
      name: [null, [Validators.required]],
      type: [DataKeyType.attribute, [Validators.required]]
    });
    this.labelDataKeyFormGroup.valueChanges.subscribe(() => {
      this.updateModel();
    });
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.labelDataKeyFormGroup.disable({emitEvent: false});
    } else {
      this.labelDataKeyFormGroup.enable({emitEvent: false});
    }
  }

  writeValue(value: LabelDataKey): void {
    this.modelValue = value;
    this.labelDataKeyFormGroup.patchValue(
      value, {emitEvent: false}
    );
  }

  labelDataKeyText(): string {
    const name: string = this.labelDataKeyFormGroup.get('name').value || '';
    const type: DataKeyType = this.labelDataKeyFormGroup.get('type').value;
    let typeStr: string;
    if (type === DataKeyType.attribute) {
      typeStr = this.translate.instant('widgets.chart.key-type-attribute');
    } else if (type === DataKeyType.timeseries) {
      typeStr = this.translate.instant('widgets.chart.key-type-timeseries');
    }
    return `${name} (${typeStr})`;
  }

  private updateModel() {
    const value: LabelDataKey = this.labelDataKeyFormGroup.value;
    this.modelValue = value;
    this.propagateChange(this.modelValue);
  }
}
