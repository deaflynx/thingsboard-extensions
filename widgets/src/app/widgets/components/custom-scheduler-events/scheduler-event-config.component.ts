///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {
  AfterViewInit,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { ControlValueAccessor, FormBuilder, FormGroup, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppState } from '@app/core/core.state';
import { TranslateService } from '@ngx-translate/core';
import { UserPermissionsService } from '@core/public-api';
import { SchedulerEventConfiguration } from './scheduler-event.models';
import { deepClone, isDefined } from '@core/public-api';
import { SchedulerEventConfigType } from './scheduler-event-config.models';

@Component({
  selector: 'tb-scheduler-event-config',
  templateUrl: './scheduler-event-config.component.html',
  styleUrls: ['./scheduler-event-config.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SchedulerEventConfigComponent),
    multi: true
  }]
})
export class SchedulerEventConfigComponent implements ControlValueAccessor, OnInit, AfterViewInit, OnChanges, OnDestroy {

  schedulerEventConfigFormGroup: FormGroup;

  modelValue: SchedulerEventConfiguration | null;

  @Input()
  disabled: boolean;

  @Input()
  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};

  @Input()
  schedulerEventType: string;

  useDefinedTemplate = false;
  showOriginator = true;
  showMsgType = true;
  showMetadata = true;

  private propagateChange = (v: any) => { };

  constructor(private store: Store<AppState>,
              public translate: TranslateService,
              private userPermissionsService: UserPermissionsService,
              private fb: FormBuilder) {
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  ngOnInit() {
    this.schedulerEventConfigFormGroup = this.fb.group({
      originatorId: [null],
      msgType: [null],
      configuration: [null, Validators.required],
      msgBody: [null, Validators.required],
      metadata: [null]
    });
    this.schedulerEventConfigFormGroup.valueChanges.subscribe(() => {
      this.updateView();
    });
    this.buildSchedulerEventConfigForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propName of Object.keys(changes)) {
      const change = changes[propName];
      if (!change.firstChange && change.currentValue !== change.previousValue) {
        if (propName === 'schedulerEventType' && change.currentValue) {
          this.buildSchedulerEventConfigForm();
        }
      }
    }
  }

  private buildSchedulerEventConfigForm() {
    this.useDefinedTemplate = false;
    this.showOriginator = true;
    this.showMsgType = true;
    this.showMetadata = true;
    if (this.schedulerEventType) {
      const configType = this.schedulerEventConfigTypes[this.schedulerEventType];
      if (configType) {
        this.useDefinedTemplate = isDefined(configType.template) || isDefined(configType.componentType);
        this.showOriginator = configType.originator;
        this.showMsgType = configType.msgType;
        this.showMetadata = configType.metadata;
      }
    }
    this.updateEnabledState();
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.schedulerEventConfigFormGroup.disable({emitEvent: false});
    } else {
      this.updateEnabledState();
    }
  }

  private updateEnabledState() {
    if (!this.disabled) {
      if (this.showOriginator) {
        this.schedulerEventConfigFormGroup.get('originatorId').enable({emitEvent: false});
      } else {
        this.schedulerEventConfigFormGroup.get('originatorId').disable({emitEvent: false});
      }
      if (this.showMsgType) {
        this.schedulerEventConfigFormGroup.get('msgType').enable({emitEvent: false});
      } else {
        this.schedulerEventConfigFormGroup.get('msgType').disable({emitEvent: false});
      }
      if (this.useDefinedTemplate) {
        this.schedulerEventConfigFormGroup.get('configuration').enable({emitEvent: false});
        this.schedulerEventConfigFormGroup.get('msgBody').disable({emitEvent: false});
      } else {
        this.schedulerEventConfigFormGroup.get('msgBody').enable({emitEvent: false});
        this.schedulerEventConfigFormGroup.get('configuration').disable({emitEvent: false});
      }
      if (this.showMetadata) {
        this.schedulerEventConfigFormGroup.get('metadata').enable({emitEvent: false});
      } else {
        this.schedulerEventConfigFormGroup.get('metadata').disable({emitEvent: false});
      }
    }
  }

  writeValue(value: SchedulerEventConfiguration | null): void {
    this.modelValue = value;
    const model = deepClone(this.modelValue) || undefined;
    if (model) {
      (model as any).configuration = deepClone(model);
    }
    this.schedulerEventConfigFormGroup.reset(model,{emitEvent: false});
  }

  updateView() {
    if (this.schedulerEventConfigFormGroup.valid) {
      let schedulerEventConfig = this.schedulerEventConfigFormGroup.value;
      if (schedulerEventConfig) {
        if (this.useDefinedTemplate) {
          const configuration = schedulerEventConfig.configuration;
          if (!configuration.originatorId) {
            delete configuration.originatorId;
          }
          if (!configuration.msgType) {
            delete configuration.msgType;
          }
          if (!configuration.metadata) {
            delete configuration.metadata;
          }
          delete schedulerEventConfig.configuration;
          if (configuration) {
            schedulerEventConfig = {...schedulerEventConfig, ...configuration};
          }
        }
      }
      this.modelValue = schedulerEventConfig;
      this.propagateChange(this.modelValue);
    } else {
      this.propagateChange(null);
    }
  }
}
