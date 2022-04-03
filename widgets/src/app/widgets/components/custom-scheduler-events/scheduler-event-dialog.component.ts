/*
///
/// ThingsBoard, Inc. ("COMPANY") CONFIDENTIAL
///
/// Copyright © 2016-2022 ThingsBoard, Inc. All Rights Reserved.
///
/// NOTICE: All information contained herein is, and remains
/// the property of ThingsBoard, Inc. and its suppliers,
/// if any.  The intellectual and technical concepts contained
/// herein are proprietary to ThingsBoard, Inc.
/// and its suppliers and may be covered by U.S. and Foreign Patents,
/// patents in process, and are protected by trade secret or copyright law.
///
/// Dissemination of this information or reproduction of this material is strictly forbidden
/// unless prior written permission is obtained from COMPANY.
///
/// Access to the source code contained herein is hereby forbidden to anyone except current COMPANY employees,
/// managers or contractors who have executed Confidentiality and Non-disclosure agreements
/// explicitly covering such access.
///
/// The copyright notice above does not evidence any actual or intended publication
/// or disclosure  of  this source code, which includes
/// information that is confidential and/or proprietary, and is a trade secret, of  COMPANY.
/// ANY REPRODUCTION, MODIFICATION, DISTRIBUTION, PUBLIC  PERFORMANCE,
/// OR PUBLIC DISPLAY OF OR THROUGH USE  OF THIS  SOURCE CODE  WITHOUT
/// THE EXPRESS WRITTEN CONSENT OF COMPANY IS STRICTLY PROHIBITED,
/// AND IN VIOLATION OF APPLICABLE LAWS AND INTERNATIONAL TREATIES.
/// THE RECEIPT OR POSSESSION OF THIS SOURCE CODE AND/OR RELATED INFORMATION
/// DOES NOT CONVEY OR IMPLY ANY RIGHTS TO REPRODUCE, DISCLOSE OR DISTRIBUTE ITS CONTENTS,
/// OR TO MANUFACTURE, USE, OR SELL ANYTHING THAT IT  MAY DESCRIBE, IN WHOLE OR IN PART.
///

import { Component, Inject, OnDestroy, OnInit, SkipSelf } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { AppState } from '@core/public-api';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogComponent } from '@shared/public-api';
import { SchedulerEvent } from '@shared/models/scheduler-event.models';
import { SchedulerEventService } from '@core/public-api';
import { SchedulerEventConfigType } from '@home/components/scheduler/scheduler-event-config.models';
import { isObject, isString } from '@core/public-api';
import { PageComponent } from '@shared/components/page.component';
import { Subscription } from 'rxjs';
import * as i0 from '@angular/core';

export interface SchedulerEventDialogData {
  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};
  isAdd: boolean;
  readonly: boolean;
  schedulerEvent: SchedulerEvent;
  defaultEventType: string;
}

@Component({
  selector: 'tb-scheduler-event-dialog',
  templateUrl: './scheduler-event-dialog.component.html',
  providers: [{provide: ErrorStateMatcher, useExisting: SchedulerEventDialogComponent}],
  styleUrls: ['./scheduler-event-dialog.component.scss']
})

export class SchedulerEventDialogComponent extends DialogComponent<SchedulerEventDialogComponent, boolean>
  implements OnInit, ErrorStateMatcher {

  schedulerEventFormGroup: FormGroup;

  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};
  isAdd: boolean;
  readonly: boolean;
  schedulerEvent: SchedulerEvent;
  defaultEventType: string;

  submitted = false;

  constructor(protected store: Store<AppState>,
              protected router: Router,
              @Inject(MAT_DIALOG_DATA) public data: SchedulerEventDialogData,
              private schedulerEventService: SchedulerEventService,
              @SkipSelf() private errorStateMatcher: ErrorStateMatcher,
              public dialogRef: MatDialogRef<SchedulerEventDialogComponent, boolean>,
              public fb: FormBuilder) {
    super(store, router, dialogRef);
    this.schedulerEventConfigTypes = data.schedulerEventConfigTypes;
    this.isAdd = data.isAdd;
    this.readonly = data.readonly;
    this.schedulerEvent = data.schedulerEvent;
    this.defaultEventType = data.defaultEventType;
  }

  ngOnInit(): void {
    this.schedulerEventFormGroup = this.fb.group({
      name: [this.schedulerEvent.name, [Validators.required, Validators.maxLength(255)]],
      type: [this.isAdd ? this.defaultEventType : this.schedulerEvent.type, [Validators.required]],
      configuration: [this.schedulerEvent.configuration, [Validators.required]],
      schedule: [this.schedulerEvent.schedule, [Validators.required]]
    });
    if (this.readonly) {
      this.schedulerEventFormGroup.disable();
    } else if (this.defaultEventType) {
      this.schedulerEventFormGroup.get('type').disable();
    } else if (!this.readonly) {
      this.schedulerEventFormGroup.get('type').valueChanges.subscribe((newVal) => {
        const prevVal = this.schedulerEventFormGroup.value.type;
        if (newVal !== prevVal && newVal) {
          this.schedulerEventFormGroup.get('configuration').patchValue({
            originatorId: null,
            msgType: null,
            msgBody: {},
            metadata: {}
          }, {emitEvent: false});
        }
      });
    }
  }

  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const originalErrorState = this.errorStateMatcher.isErrorState(control, form);
    const customErrorState = !!(control && control.invalid && this.submitted);
    return originalErrorState || customErrorState;
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  save(): void {
    this.submitted = true;
    if (!this.schedulerEventFormGroup.invalid) {
      this.schedulerEvent = {...this.schedulerEvent, ...this.schedulerEventFormGroup.getRawValue()};
      this.schedulerEventService.saveSchedulerEvent(this.deepTrim(this.schedulerEvent)).subscribe(
        () => {
          this.dialogRef.close(true);
        }
      );
    }
  }

  private deepTrim<T>(obj: T): T {
    return Object.keys(obj).reduce((acc, curr) => {
      if (isString(obj[curr])) {
        acc[curr] = obj[curr].trim();
      } else if (isObject(obj[curr])) {
        acc[curr] = this.deepTrim(obj[curr]);
      } else {
        acc[curr] = obj[curr];
      }
      return acc;
    }, Array.isArray(obj) ? [] : {}) as T;
  }
}

// /!*
//  * Copyright Â© 2020 ThingsBoard
//  *!/
// /!*@ngInject*!/
// export default function SchedulerEventDialogController($rootScope, $scope, $mdDialog, schedulerEventService, types,
//                                                        configTypesList, isAdd, readonly, schedulerEvent, defaultEventType,
//                                                        entityViewService, entityRelationService, ctx) {
//
//   var vm = this;
//
//   vm.types = types;
//
//   vm.ctx = ctx;
//
//   vm.defaultTimezone = moment.tz.guess(); //eslint-disable-line
//
//   vm.configTypesList = configTypesList;
//
//   vm.configTypes = {};
//   configTypesList.forEach((configType) => {
//     vm.configTypes[configType.value] = configType;
//   });
//
//   vm.schedulerEvent = schedulerEvent;
//   vm.defaultEventType = defaultEventType;
//   vm.isAdd = isAdd;
//   vm.readonly = readonly;
//   vm.repeatType = types.schedulerRepeat;
//   vm.timeUnits = types.schedulerTimeUnit;
//
//   var startDate;
//   if (vm.isAdd) {
//     vm.schedulerEvent.type = vm.defaultEventType;
//     if (!vm.schedulerEvent.schedule.timezone) {
//       vm.schedulerEvent.schedule.timezone = vm.defaultTimezone;
//     }
//     if (!vm.schedulerEvent.schedule.startTime) {
//       var date = new Date();
//       startDate = new Date(
//         date.getFullYear(),
//         date.getMonth(),
//         date.getDate());
//     } else {
//       startDate = dateFromUtcTime(vm.schedulerEvent.schedule.startTime);
//     }
//   } else {
//     startDate = dateFromUtcTime(vm.schedulerEvent.schedule.startTime);
//     if (vm.schedulerEvent.schedule.repeat) {
//       if (vm.schedulerEvent.schedule.repeat.type == types.schedulerRepeat.weekly.value &&
//         vm.schedulerEvent.schedule.repeat.repeatOn) {
//         vm.weeklyRepeat = [];
//         for (var i = 0; i < vm.schedulerEvent.schedule.repeat.repeatOn.length; i++) {
//           vm.weeklyRepeat[vm.schedulerEvent.schedule.repeat.repeatOn[i]] = true;
//         }
//       } else if (vm.schedulerEvent.schedule.repeat.type == types.schedulerRepeat.timer.value) {
//         vm.timerRepeat = [];
//         vm.timerRepeat.repeatInterval = vm.schedulerEvent.schedule.repeat.repeatInterval;
//         vm.timerRepeat.timeUnit = vm.schedulerEvent.schedule.repeat.timeUnit;
//       }
//       vm.endsOn = dateFromUtcTime(vm.schedulerEvent.schedule.repeat.endsOn);
//     }
//   }
//   setStartDate(startDate);
//
//   vm.lastAppliedTimezone = vm.schedulerEvent.schedule.timezone;
//
//   vm.repeat = vm.schedulerEvent.schedule.repeat ? true : false;
//
//   vm.repeatsChange = repeatsChange;
//   vm.repeatTypeChange = repeatTypeChange;
//   vm.weekDayChange = weekDayChange;
//
//   vm.save = save;
//   vm.cancel = cancel;
//
//   $scope.$watch('vm.schedulerEvent.type', function (newValue, prevValue) {
//     if (!angular.equals(newValue, prevValue)) {
//       vm.schedulerEvent.configuration = {
//         originatorId: null,
//         msgType: null,
//         msgBody: {},
//         metadata: {}
//       }
//     }
//   });
//
//   $scope.$watch('vm.schedulerEvent.schedule.timezone', function (newValue, prevValue) {
//     if (!angular.equals(newValue, prevValue) && newValue) {
//       timezoneChange();
//     }
//   });
//
//   function dateFromUtcTime(time, timezone) {
//     if (!timezone) {
//       timezone = vm.schedulerEvent.schedule.timezone;
//     }
//     var offset = moment.tz.zone(timezone).utcOffset(time) * 60 * 1000; //eslint-disable-line
//     return new Date(time - offset + new Date().getTimezoneOffset() * 60 * 1000);
//   }
//
//   function dateTimeToUtcTime(date, timezone) {
//     if (!timezone) {
//       timezone = vm.schedulerEvent.schedule.timezone;
//     }
//     var ts = new Date(
//       date.getFullYear(),
//       date.getMonth(),
//       date.getDate(),
//       date.getHours(),
//       date.getMinutes(),
//       date.getSeconds(),
//       date.getMilliseconds()
//     ).getTime();
//     var offset = moment.tz.zone(timezone).utcOffset(ts) * 60 * 1000; //eslint-disable-line
//     return ts + offset - new Date().getTimezoneOffset() * 60 * 1000;
//   }
//
//   function dateToUtcTime(date, timezone) {
//     if (!timezone) {
//       timezone = vm.schedulerEvent.schedule.timezone;
//     }
//     var ts = new Date(
//       date.getFullYear(),
//       date.getMonth(),
//       date.getDate()
//     ).getTime();
//     var offset = moment.tz.zone(timezone).utcOffset(ts) * 60 * 1000; //eslint-disable-line
//     return ts + offset - new Date().getTimezoneOffset() * 60 * 1000;
//   }
//
//   function timezoneChange() {
//     if (!angular.equals(vm.schedulerEvent.schedule.timezone, vm.lastAppliedTimezone)) {
//       var startTime = dateTimeToUtcTime(vm.startDate, vm.lastAppliedTimezone);
//       var startDate = dateFromUtcTime(startTime);
//       setStartDate(startDate);
//       if (vm.endsOn) {
//         var endsOnTime = dateToUtcTime(vm.endsOn, vm.lastAppliedTimezone);
//         vm.endsOn = dateFromUtcTime(endsOnTime);
//       }
//       vm.lastAppliedTimezone = vm.schedulerEvent.schedule.timezone;
//     }
//   }
//
//   function setStartDate(startDate) {
//     vm.startDate = startDate;
//   }
//
//   function repeatsChange() {
//     if (vm.repeat) {
//       if (!vm.schedulerEvent.schedule.repeat) {
//         vm.schedulerEvent.schedule.repeat = {
//           type: types.schedulerRepeat.daily.value
//         }
//       }
//       vm.endsOn = new Date(
//         vm.startDate.getFullYear(),
//         vm.startDate.getMonth(),
//         vm.startDate.getDate() + 5);
//     }
//   }
//
//   function repeatTypeChange() {
//     if (vm.repeat && vm.schedulerEvent.schedule.repeat && vm.schedulerEvent.schedule.repeat.type == types.schedulerRepeat.weekly.value) {
//       if (!vm.weeklyRepeat) {
//         vm.weeklyRepeat = [];
//       }
//       weekDayChange();
//     }
//   }
//
//   function weekDayChange() {
//     if (vm.repeat && vm.startDate) {
//       var setCurrentDay = true;
//       for (var i = 0; i < 7; i++) {
//         if (vm.weeklyRepeat[i]) {
//           setCurrentDay = false;
//           break;
//         }
//       }
//       if (setCurrentDay) {
//         var day = moment(vm.startDate).day(); //eslint-disable-line
//         vm.weeklyRepeat[day] = true;
//       }
//     }
//   }
//
//   function cancel() {
//     $mdDialog.cancel();
//   }
//
//   function save() {
//     if (!vm.repeat) {
//       delete vm.schedulerEvent.schedule.repeat;
//     } else {
//       vm.schedulerEvent.schedule.repeat.endsOn = dateToUtcTime(vm.endsOn);
//       if (vm.schedulerEvent.schedule.repeat.type == types.schedulerRepeat.weekly.value) {
//         vm.schedulerEvent.schedule.repeat.repeatOn = [];
//         for (var i = 0; i < 7; i++) {
//           if (vm.weeklyRepeat[i]) {
//             vm.schedulerEvent.schedule.repeat.repeatOn.push(i);
//           }
//         }
//       } else if (vm.schedulerEvent.schedule.repeat.type == types.schedulerRepeat.timer.value) {
//         vm.schedulerEvent.schedule.repeat.repeatInterval = vm.timerRepeat.repeatInterval;
//         vm.schedulerEvent.schedule.repeat.timeUnit = vm.timerRepeat.timeUnit;
//       }
//       else {
//         delete vm.schedulerEvent.schedule.repeat.repeatOn;
//       }
//     }
//     vm.schedulerEvent.schedule.startTime = dateTimeToUtcTime(vm.startDate);
//     vm.schedulerEvent.name = vm.schedulerEvent.type;
//     if(vm.ctx.datasources[0].entityId) {
//       entityRelationService.findByFrom(vm.ctx.datasources[0].entityId, vm.ctx.datasources[0].entityType).then((relations) => {
//         if(!relations.length || !relations[0] || !relations[0].to){
//           $mdDialog.hide();
//         }
//         vm.schedulerEvent.configuration.originatorId = relations[0].to;
//         vm.schedulerEvent.configuration.metadata = {
//           deviceId: vm.ctx.datasources[0].entityId
//         };
//         schedulerEventService.saveSchedulerEvent(vm.schedulerEvent).then(
//           () => {
//             $mdDialog.hide();
//           }
//         );
//       })
//     } else {
//       entityViewService.getUserEntityViews({limit:1}).then((res) => {
//         if(!res.data.length){
//           $mdDialog.hide();
//         }
//         vm.schedulerEvent.configuration.originatorId = res.data[0].id;
//         vm.schedulerEvent.configuration.metadata = {
//           deviceId: res.data[0].entityId.id
//         };
//         schedulerEventService.saveSchedulerEvent(vm.schedulerEvent).then(
//           () => {
//             $mdDialog.hide();
//           }
//         );
//       })
//     }
//   }
// }
*/

import { Component } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';

@Component({
  selector: 'tb-scheduler-event-dialog',
  templateUrl: './scheduler-event-dialog.component.html',
  providers: [{provide: ErrorStateMatcher, useExisting: SchedulerEventDialogComponent}],
  styleUrls: ['./scheduler-event-dialog.component.scss']
})

export class SchedulerEventDialogComponent {
  constructor() {
  }
}
