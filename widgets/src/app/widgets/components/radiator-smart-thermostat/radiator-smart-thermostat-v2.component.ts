///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import {
  FormArray,
  FormBuilder, FormControl,
  FormGroup,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { AppState, AttributeService, DeviceService, RuleEngineService } from '@core/public-api';
import {
  AttributeData,
  AttributeScope,
  Device,
  getTimezoneInfo,
  PageComponent
} from '@shared/public-api';
import { WidgetContext } from '@home/models/widget-component.models';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { Observable, of } from 'rxjs';

interface RadiatorSmartThermostatData {
  openTime: string,
  openFlow: number,
  closeTime: string,
  closeFlow: number,
}

@Component({
  selector: 'radiator-smart-thermostat-v2',
  templateUrl: './radiator-smart-thermostat-v2.component.html',
  styleUrls: ['./radiator-smart-thermostat-v2.component.scss']
})
export class RadiatorSmartThermostatV2Component extends PageComponent implements OnInit, AfterViewInit {

  @Input() ctx: WidgetContext;

  device: Device;

  form: FormGroup;

  templateForm: FormGroup;

  allDaysIndex = Array(7).fill(0).map((x, i) => i);

  allDaysValue: Array<string>;

  percentages = [0, 100];

  dayOfWeekTranslationsArray = new Array<string>(
    'device-profile.schedule-day.monday',
    'device-profile.schedule-day.tuesday',
    'device-profile.schedule-day.wednesday',
    'device-profile.schedule-day.thursday',
    'device-profile.schedule-day.friday',
    'device-profile.schedule-day.saturday',
    'device-profile.schedule-day.sunday'
  );

  private initConfigAttributes: any;

  private thermostatConfigAttributes = 'radiatorSmartThermostatConfig';

  private templateConfigAttributes = 'template_radiatorSmartThermostatConfig';

  private emptyValue = 'N/A';

  private validTimeRegex: string = `^([01]\\d|2[0-3]):([0-5]\\d)$`;

  private hasInitThermostatConfigAttributes: boolean = false;

  timeFormatErrorText: string = "24-hour format is required e.g. 23:59";

  openCloseTimeErrorText: string = "Operation Time can't be later than Close";

  templatesAttributes = {
    key: this.templateConfigAttributes,
    value: []
  };

  configTemplatesObservable: Observable<any[]>;

  templateTitleChanged: boolean;

  hourDiff: number = 0;

  private defaultOpenFlow = 100;
  private defaultCloseFlow = 0;

  get itemsSchedulerForm(): FormArray {
    return this.form?.get('items') as FormArray;
  }

  constructor(protected store: Store<AppState>,
              private fb: FormBuilder,
              private attributeService: AttributeService,
              private deviceService: DeviceService,
              private ruleEngineService: RuleEngineService,
              private translate: TranslateService) {
    super(store);
  }

  ngOnInit() {
    this.getTimezoneDiff();
    this.getDaysOfTheWeek();
    this.buildSchedulerForm();
    this.buildTemplateForm();
  }

  private getTimezoneDiff() {
    const timezone = getTimezoneInfo(this.ctx.dashboard.dashboardTimewindow?.timezone);
    if (timezone) {
      this.setHourDiffFromTimewindowTimezone(timezone);
    } else {
      this.setHourDiffFromBrowserTimezone();
    }
    this.ctx.dashboard.dashboardTimewindowChanged.subscribe(timewindow => {
      const timezone = getTimezoneInfo(timewindow.timezone);
      if (timezone) {
        this.setHourDiffFromTimewindowTimezone(timezone);
      } else {
        this.setHourDiffFromBrowserTimezone();
      }
    });
  }

  private setHourDiffFromTimewindowTimezone(timezone) {
    this.hourDiff = timezone.nOffset/60;
  }

  private setHourDiffFromBrowserTimezone() {
    const date = new Date();
    this.hourDiff = (date.getTimezoneOffset()/60)*-1;
  }

  private getDaysOfTheWeek() {
    this.allDaysValue = this.dayOfWeekTranslationsArray.map(value => this.translate.instant(value).toLowerCase());
  }

  private buildSchedulerForm() {
    this.form = this.fb.group({
      items: this.fb.array(Array.from({length: 7}, (value, i) => this.defaultItemsScheduler(i)))
    });
  }

  private buildTemplateForm() {
    this.templateForm = this.fb.group({
      key: [null, []],
      value: [null, []]
    });
    this.templateForm.get('key').valueChanges.subscribe(() => {
      this.templateTitleChanged = true;
    });
  }

  private defaultItemsScheduler(index): FormGroup {
    return this.fb.group({
      enabled: [true],
      dayOfWeek: [this.allDaysValue[index]],
      openTime: [null, [Validators.required, Validators.pattern(this.validTimeRegex), this.validateOpenCloseTime(index, 'openTime')]],
      closeTime: [null, [Validators.required, Validators.pattern(this.validTimeRegex), this.validateOpenCloseTime(index, 'closeTime')]],
      openFlow: [null, []],
      closeFlow: [null, []]
    });
  }

  ngAfterViewInit() {
    const entityId = this.ctx.stateController.getStateParams().entityId;
    if (entityId?.id) {
      this.deviceService.getDevice(entityId.id).subscribe(device => {
        this.device = device;
        this.getThermostatAttributes();
        this.getTemplates();
      });
    }
  }

  private getThermostatAttributes() {
    this.attributeService.getEntityAttributes(this.device.id, AttributeScope.SERVER_SCOPE, [this.thermostatConfigAttributes]).subscribe(
      attributes => {
        let value = {};
        if (attributes.length) {
          this.hasInitThermostatConfigAttributes = true;
          value = attributes[0].value;
        } else {
          const defaultDayConfig = {
            "openTime": "08:00",
            "closeTime": "18:00",
            "openFlow": this.defaultOpenFlow,
            "closeFlow": this.defaultCloseFlow
          };
          value = {
            monday: defaultDayConfig,
            tuesday: defaultDayConfig,
            wednesday: defaultDayConfig,
            thursday: defaultDayConfig,
            friday: defaultDayConfig,
            saturday: defaultDayConfig,
            sunday: defaultDayConfig
          };
        }
        this.patchFormValues(value);
        this.setInitConfigAttributes(value);
      }
    );
  }

  private getTemplates() {
    this.attributeService.getEntityAttributes(this.device.ownerId, AttributeScope.SERVER_SCOPE, [this.templateConfigAttributes])
      .subscribe(attributes => {
        if (attributes.length) {
          this.templatesAttributes = attributes[0];
          this.configTemplatesObservable = of(this.templatesAttributes.value);
        }
      })
  }

  private patchFormValues(attributes: any) {
    for (let key in attributes) {
      let index = this.allDaysValue.indexOf(key);
      if (index > -1) {
        let data = Object.assign({}, attributes[key]);
        if (data?.openTime) {
          data.enabled = true;
          data.dayOfWeek = key;
          this.itemsSchedulerForm.at(index).patchValue(data);
          this.enableItems(index);
        } else {
          data = {};
          data.enabled = false;
          data.dayOfWeek = key;
          data.openFlow = null;
          data.openTime = null;
          data.closeFlow = null;
          data.closeTime = null;
          this.itemsSchedulerForm.at(index).patchValue(data);
          this.disableItems(index);
        }
      }
    }
  }

  private setInitConfigAttributes(attributes) {
    this.initConfigAttributes = attributes;
  }

  changeCustomScheduler($event: MatCheckboxChange, index: number) {
    const value = $event.checked;
    this.disabledSelectedTime(value, index, true);
  }

  private disabledSelectedTime(enable: boolean, index: number, emitEvent = false) {
    if (enable) {
      this.enableItems(index);
    } else {
      this.disableItems(index);
    }
  }

  private disableItems(index: number, emitEvent: boolean = false) {
    this.itemsSchedulerForm.at(index).get('openTime').disable({emitEvent});
    this.itemsSchedulerForm.at(index).get('closeTime').disable({emitEvent});
    this.itemsSchedulerForm.at(index).get('openFlow').disable({emitEvent});
    this.itemsSchedulerForm.at(index).get('closeFlow').disable({emitEvent});
  }

  private enableItems(index: number, emitEvent: boolean = false) {
    this.itemsSchedulerForm.at(index).get('openTime').enable({emitEvent});
    this.itemsSchedulerForm.at(index).get('closeTime').enable({emitEvent});
    this.itemsSchedulerForm.at(index).get('openFlow').enable({emitEvent});
    this.itemsSchedulerForm.at(index).get('closeFlow').enable({emitEvent});
    this.itemsSchedulerForm.at(index).get('openFlow').patchValue(this.defaultOpenFlow);
    this.itemsSchedulerForm.at(index).get('closeFlow').patchValue(this.defaultCloseFlow);
  }

  save() {
    this.form.markAsPristine();
    const [deviceAttributesData, ruleEngineRequestData] = [...this.prepareData()];
    this.attributeService.saveEntityAttributes(this.device.id, AttributeScope.SERVER_SCOPE, [deviceAttributesData]).subscribe();
    this.ruleEngineService.makeRequestToRuleEngineFromEntity(this.device.id, ruleEngineRequestData).subscribe();
  }

  private prepareData(): Array<AttributeData | any> {
    const key = this.thermostatConfigAttributes;
    const formValues = this.form.get('items').value;
    const deviceAttributesValue = {};
    const ruleEngineRequestData = {};
    formValues.map(value => {
      let key = value.dayOfWeek;
      let newValue: RadiatorSmartThermostatData | string;
      if (value.openTime) {
        newValue = {
          openTime: value.openTime,
          closeTime: value.closeTime,
          openFlow: this.defaultOpenFlow,
          closeFlow: this.defaultCloseFlow
        }
      } else {
        newValue = this.emptyValue;
      }
      deviceAttributesValue[key] = newValue;
      if (this.hasInitThermostatConfigAttributes) {
        let newValueStringify = JSON.stringify(this.orderKeys(newValue));
        let initValueStringify = JSON.stringify(this.orderKeys(this.initConfigAttributes[key]));
        if (newValueStringify !== initValueStringify) {
          ruleEngineRequestData[key] = this.transformTimeToUTCTimezone(newValue);
        }
      } else {
        ruleEngineRequestData[key] = this.transformTimeToUTCTimezone(newValue);
      }
    });

    this.setInitConfigAttributes(deviceAttributesValue);

    const deviceAttributesData: AttributeData = {
      key,
      value: deviceAttributesValue
    };
    return [deviceAttributesData, {deltaRadiatorSmartThermostatConfig: ruleEngineRequestData}];
  }

  private orderKeys(object): any {
    return Object.keys(object).sort().reduce(
      (obj, key) => {
        obj[key] = object[key];
        return obj;
      },
      {}
    );
  }

  private transformTimeToUTCTimezone(value): RadiatorSmartThermostatData {
    let valueCopy = {...value};
    if (this.hourDiff && valueCopy?.openTime && valueCopy?.closeTime) {
      var [openTimeHour, openTimeMinute]  = valueCopy.openTime.split(':');
      var [closeTimeHour, closeTimeMinute] = valueCopy.closeTime.split(':');
      var newOpenTimeHour = openTimeHour - this.hourDiff;
      var newCloseTimeHour = closeTimeHour - this.hourDiff;
      if (newOpenTimeHour < 0) {
        newOpenTimeHour = 24 + newOpenTimeHour;
      } else if (newOpenTimeHour > 23) {
        newOpenTimeHour = newOpenTimeHour - 24;
      }
      if (newCloseTimeHour < 0) {
        newCloseTimeHour = 24 + newCloseTimeHour;
      } else if (newCloseTimeHour > 23) {
        newCloseTimeHour = newCloseTimeHour - 24;
      }
      valueCopy.openTime = newOpenTimeHour + ':' + openTimeMinute;
      valueCopy.closeTime = newCloseTimeHour + ':' + closeTimeMinute;
      if (newOpenTimeHour < 10) valueCopy.openTime = '0' + valueCopy.openTime;
      if (newCloseTimeHour < 10) valueCopy.closeTime = '0' + valueCopy.closeTime;
      return valueCopy;
    } else {
      return value;
    }
  }

  private validateOpenCloseTime(i: number, control: string): ValidatorFn {
    return (c: FormControl) => {
      if (this.itemsSchedulerForm?.length) {
        const value = this.itemsSchedulerForm.controls[i];
        let openTime,
            closeTime,
            controlToCheck;
        if (control === 'openTime') {
          openTime = c.value;
          closeTime = value.value.closeTime;
          controlToCheck = 'closeTime';
        } else {
          openTime = value.value.openTime;
          closeTime = c.value;
          controlToCheck = 'openTime';
        }
        if (openTime && closeTime) {
          const [openTimeHour, openTimeMinutes] = [...openTime.split(':')];
          const [closeTimeHour, closeTimeMinutes] = [...closeTime.split(':')];
          if ((openTimeHour > closeTimeHour) || (openTimeHour === closeTimeHour && openTimeMinutes >= closeTimeMinutes)) {
            return { time:{valid: false} };
          } else {
            const hasError = this.itemsSchedulerForm.at(i).get(controlToCheck).hasError('time');
            if (hasError) {
              const value = this.itemsSchedulerForm.at(i).get(controlToCheck).value;
              this.itemsSchedulerForm.at(i).get(controlToCheck).setErrors({time: null});
              this.itemsSchedulerForm.at(i).get(controlToCheck).patchValue(value);
              this.itemsSchedulerForm.at(i).get(controlToCheck).updateValueAndValidity();
            }
          }
        }
      }
      return null;
    };
  };

}
