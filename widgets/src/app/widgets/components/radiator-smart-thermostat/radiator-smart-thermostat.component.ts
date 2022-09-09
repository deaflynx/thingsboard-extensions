///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { AfterViewInit, Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppState, AttributeService, DeviceService, RuleEngineService } from '@core/public-api';
import { AttributeData, AttributeScope, Device, PageComponent } from '@shared/public-api';
import { WidgetContext } from '@home/models/widget-component.models';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { Observable, of } from "rxjs";
import {map, mergeMap, mergeMapTo} from "rxjs/operators";

interface RadiatorSmartThermostatData {
  openTime: string,
  openFlow: number,
  closeTime: string,
  closeFlow: number,
}

@Component({
  selector: 'radiator-smart-thermostat',
  templateUrl: './radiator-smart-thermostat.component.html',
  styleUrls: ['./radiator-smart-thermostat.component.scss']
})
export class RadiatorSmartThermostatComponent extends PageComponent implements OnInit, AfterViewInit {

  @Input() ctx: WidgetContext;

  device: Device;

  form: FormGroup;

  templateForm: FormGroup;

  allDaysIndex = Array(7).fill(0).map((x, i) => i);

  allDaysValue: Array<string>;

  percentages = [0, 100];

  dayOfWeekTranslationsArray = new Array<string> (
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

  timeFormatErrorText: string = "24-hour format is required e.g. 23:59";

  templatesAttributes: any;

  configTemplatesObservable: Observable<any[]>;

  get itemsSchedulerForm(): FormArray {
    return this.form.get('items') as FormArray;
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
    this.getDaysOfTheWeek();

    this.buildSchedulerForm();
    this.buildTemplateForm();
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
      key: ['', []],
      value: ['', []]
    });
  }

  private defaultItemsScheduler(index): FormGroup {
    return this.fb.group({
      enabled: [true],
      dayOfWeek: [this.allDaysValue[index]],
      openTime: [null, [Validators.required, Validators.pattern(this.validTimeRegex)]],
      closeTime: [null, [Validators.required, Validators.pattern(this.validTimeRegex)]],
      openFlow: [null, [Validators.required]],
      closeFlow: [null, [Validators.required]]
    });
  }

  ngAfterViewInit() {
    const entityId = this.ctx.stateController.getStateParams().entityId;
    this.deviceService.getDevice(entityId.id).subscribe(device => {
      this.device = device;
      this.getThermostatAttributes();
      this.getTemplates();
    });
  }

  private getThermostatAttributes() {
    this.attributeService.getEntityAttributes(this.device.id, AttributeScope.SERVER_SCOPE, [this.thermostatConfigAttributes]).subscribe(
      attributes => {
        if (attributes.length) this.patchValues(attributes[0].value);
      }
    );
  }

  private getTemplates() {
    this.configTemplatesObservable = this.attributeService.getEntityAttributes(this.device.ownerId, AttributeScope.SERVER_SCOPE, [this.templateConfigAttributes])
      .pipe(
        map(attributes => {
          this.templatesAttributes = attributes[0];
          return attributes[0].value;
        })
      );
  }

  private patchValues(attributes: AttributeData) {
    this.setInitConfigAttributes(attributes);
    for (let key in attributes) {
      let index = this.allDaysValue.indexOf(key);
      if (index > -1) {
        const data = Object.assign({}, attributes[key]);
        if (data?.openTime) {
          data.enabled = true;
          data.dayOfWeek = key;
          this.itemsSchedulerForm.at(index).patchValue(data);
        } else {
          data.enabled = false;
          data.dayOfWeek = key;
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
          openFlow: value.openFlow,
          closeFlow: value.closeFlow
        }
      } else {
        newValue = this.emptyValue;
      }

      deviceAttributesValue[key] = newValue;

      let newValueStringify = JSON.stringify(this.orderKeys(newValue));
      let initValueStringify = JSON.stringify(this.orderKeys(this.initConfigAttributes[key]));
      if (newValueStringify !== initValueStringify) {
        ruleEngineRequestData[key] = newValue;
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

  saveTemplate() {
    const currentConfig = this.prepareTemplate();
    this.templatesAttributes.value = this.templatesAttributes.value.concat(currentConfig);
    this.attributeService.saveEntityAttributes(this.device.ownerId, AttributeScope.SERVER_SCOPE, [this.templatesAttributes])
      .subscribe(() => this.getTemplates());
  }

  private prepareTemplate(): AttributeData {
    const key = this.templateForm.get('key').value;
    const formValues = this.form.get('items').value;
    const value = {};
    formValues.map(config => {
      let key = config.dayOfWeek;
      let newValue: RadiatorSmartThermostatData | string;
      if (config.openTime) {
        newValue = {
          openTime: config.openTime,
          closeTime: config.closeTime,
          openFlow: config.openFlow,
          closeFlow: config.closeFlow
        }
      } else {
        newValue = this.emptyValue;
      }
      value[key] = newValue;
    });
    return { key, value } as AttributeData;
  }

  loadTemplate() {
    const targetTemplate = this.templateForm.get('value')?.value;
    this.patchValues(targetTemplate?.value);
  }

  deleteTemplate() {
    const targetTemplate = this.templateForm.get('value')?.value;
    let newConfigTemplates = [...this.templatesAttributes.value].filter(template => template.key !== targetTemplate?.key);
    const configTemplatesAttributes = [{
      key: this.templateConfigAttributes,
      value: newConfigTemplates
    }];
    this.attributeService.saveEntityAttributes(this.device.ownerId, AttributeScope.SERVER_SCOPE, configTemplatesAttributes).subscribe();
  }

}
