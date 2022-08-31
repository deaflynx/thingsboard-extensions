///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { AfterViewInit, Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppState, AttributeService, DeviceService, RuleEngineService } from '@core/public-api';
import { AttributeData, AttributeScope, Device, PageComponent } from '@shared/public-api';
import { WidgetContext } from '@home/models/widget-component.models';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { HttpClient } from '@angular/common/http';

interface RadiatorSmartThermostatData {
  openTime: string,
  openFlow: number | string,
  closeTime: string,
  closeFlow: number | string,
}

@Component({
  selector: 'radiator-smart-thermostat',
  templateUrl: './radiator-smart-thermostat.component.html',
  styleUrls: [
    './radiator-smart-thermostat.component.scss'
  ],
  encapsulation: ViewEncapsulation.None
})
export class RadiatorSmartThermostatComponent extends PageComponent implements OnInit, AfterViewInit {

  @Input() ctx: WidgetContext;

  device: Device;

  form: FormGroup;

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

  get itemsSchedulerForm(): FormArray {
    return this.form.get('items') as FormArray;
  }

  constructor(protected store: Store<AppState>,
              private fb: FormBuilder,
              private attributeService: AttributeService,
              private deviceService: DeviceService,
              private ruleEngineService: RuleEngineService,
              private translate: TranslateService,
              private http: HttpClient) {
    super(store);
  }

  ngOnInit() {
    this.getDaysOfTheWeek();
    this.buildForm();
  }

  private getDaysOfTheWeek() {
    this.allDaysValue = this.dayOfWeekTranslationsArray.map(value => this.translate.instant(value).toLowerCase());
  }

  private buildForm() {
    this.form = this.fb.group({
      items: this.fb.array(Array.from({length: 7}, (value, i) => this.defaultItemsScheduler(i)))
    });
  }

  private defaultItemsScheduler(index): FormGroup {
    return this.fb.group({
      enabled: [true],
      dayOfWeek: [this.allDaysValue[index]],
      openTime: [null, Validators.required],
      closeTime: [null, Validators.required],
      openFlow: [null, [Validators.required]],
      closeFlow: [null, [Validators.required]]
    });
  }

  ngAfterViewInit() {
    const entityId = this.ctx.stateController.getStateParams().entityId;
    this.deviceService.getDevice(entityId.id).subscribe(device => {
      this.device = device;
      this.getThermostatAttributes();
    });
  }

  private getThermostatAttributes() {
    this.attributeService.getEntityAttributes(this.device.id, AttributeScope.SERVER_SCOPE, [this.thermostatConfigAttributes]).subscribe(
      attributes => attributes.length ? this.patchValues(attributes[0].value) : this.getOwnerAttributes()
    );
  }

  private getOwnerAttributes() {
    this.attributeService.getEntityAttributes(this.device.ownerId, AttributeScope.SERVER_SCOPE, [this.templateConfigAttributes]).subscribe(
      attributes => { if (attributes.length) this.patchValues(attributes[0].value); }
    );
  }

  private patchValues(attributes: AttributeData) {
    this.initConfigAttributes = attributes;
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
    this.attributeService.saveEntityAttributes(this.device.id, AttributeScope.SERVER_SCOPE, deviceAttributesData).subscribe();
    this.ruleEngineService.makeRequestToRuleEngineFromEntity(this.device.id, ruleEngineRequestData).subscribe();
  }

  private prepareData(): Array<Array<AttributeData> | any> {
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
    const deviceAttributesData: Array<AttributeData> = [{
      key,
      value: deviceAttributesValue
    }];
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

}
