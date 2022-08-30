///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AttributeService } from '@core/public-api';
import { AttributeData, AttributeScope, EntityType } from '@shared/public-api';

@Component({
  selector: 'radiator-smart-thermostat',
  templateUrl: './radiator-smart-thermostat.component.html',
  styleUrls: [
    './radiator-smart-thermostat.component.scss'
  ],
  encapsulation: ViewEncapsulation.None
})
export class RadiatorSmartThermostatComponent implements OnInit {

  @Input() ctx: any;

  @Input() stateParams: any;

  alarmScheduleForm: FormGroup;

  dayOfWeekTranslationsArray = new Array<string>(
    'device-profile.schedule-day.monday',
    'device-profile.schedule-day.tuesday',
    'device-profile.schedule-day.wednesday',
    'device-profile.schedule-day.thursday',
    'device-profile.schedule-day.friday',
    'device-profile.schedule-day.saturday',
    'device-profile.schedule-day.sunday'
  );

  allDays = Array(7).fill(0).map((x, i) => i);

  days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  percentages = Array(101).fill(0).map((x, i) => i);

  get itemsSchedulerForm(): FormArray {
    return this.alarmScheduleForm.get('items') as FormArray;
  }

  constructor(private fb: FormBuilder,
              private attributeService: AttributeService) { }

  ngOnInit() {
    this.buildForm();
    this.getAttributes();
  }

  changeCustomScheduler($event: MatCheckboxChange, index: number) {
    const value = $event.checked;
    this.disabledSelectedTime(value, index, true);
  }

  private buildForm() {
    this.alarmScheduleForm = this.fb.group({
      items: this.fb.array(Array.from({length: 7}, (value, i) => this.defaultItemsScheduler(i)))
    });
  }

  private defaultItemsScheduler(index): FormGroup {
    return this.fb.group({
      enabled: [true],
      dayOfWeek: [this.days[index]],
      openTime: [0, Validators.required],
      closeTime: [0, Validators.required],
      openFlow: [100, [Validators.required]],
      closeFlow: [0, [Validators.required]]
    });
  }

  private disabledSelectedTime(enable: boolean, index: number, emitEvent = false) {
    if (enable) {
      this.enableItems(index);
    } else {
      this.disableItems(index);
    }
  }

  private getAttributes() {
    this.getThermostatAttributes();
  }

  private getThermostatAttributes() {
    this.attributeService.getEntityAttributes({id: '42e154f0-214f-11ed-bd85-b918a967bfdf', entityType: EntityType.DEVICE}, AttributeScope.SERVER_SCOPE, ['radiatorSmartThermostatConfig']).subscribe(
      attributes => attributes.length ? this.patchValues(attributes[0].value) : this.getCustomerAttributes()
    );
  }

  private getCustomerAttributes() {
    this.attributeService.getEntityAttributes({id: '42e154f0-214f-11ed-bd85-b918a967bfdf', entityType: EntityType.CUSTOMER}, AttributeScope.SERVER_SCOPE, ['template_radiatorSmartThermostatConfig']).subscribe(
      attributes => attributes.length ? this.patchValues(attributes[0].value) : console.error('Customer attributes template_radiatorSmartThermostatConfig not found')
    );
  }

  private patchValues(attributes: AttributeData) {
    for (let key in attributes) {
      let index = this.days.indexOf(key);
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


}
