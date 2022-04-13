///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { Component, Inject, OnInit, SkipSelf } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogComponent, PageLink } from '@shared/public-api';
import { SchedulerEvent } from './scheduler-event.models';
import { EntityRelationService, EntityViewService, SchedulerEventService } from '@core/public-api';
import { SchedulerEventConfigType } from './scheduler-event-config.models';
import { isObject, isString } from '@core/public-api';
import { WidgetContext } from '../../models/widget-component.models';
import { map, mergeMap } from 'rxjs/operators';

export interface SchedulerEventDialogData {
  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};
  isAdd: boolean;
  readonly: boolean;
  schedulerEvent: SchedulerEvent;
  defaultEventType: string;
  ctx: WidgetContext;
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
  ctx: WidgetContext;

  submitted = false;

  constructor(protected store: Store<AppState>,
              protected router: Router,
              @Inject(MAT_DIALOG_DATA) public data: SchedulerEventDialogData,
              private schedulerEventService: SchedulerEventService,
              private entityRelationService: EntityRelationService,
              private entityViewService: EntityViewService,
              @SkipSelf() private errorStateMatcher: ErrorStateMatcher,
              public dialogRef: MatDialogRef<SchedulerEventDialogComponent, boolean>,
              public fb: FormBuilder) {
    super(store, router, dialogRef);
    this.schedulerEventConfigTypes = data.schedulerEventConfigTypes;
    this.isAdd = data.isAdd;
    this.readonly = data.readonly;
    this.schedulerEvent = data.schedulerEvent;
    this.defaultEventType = data.defaultEventType;
    this.ctx = data.ctx;
  }

  ngOnInit(): void {
    this.schedulerEventFormGroup = this.fb.group({
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
      this.schedulerEvent.name = this.schedulerEvent.type;
      if (this.ctx.datasources && this.ctx.datasources[0].entityId) {
        this.entityRelationService.findByFrom({
          id: this.ctx.datasources[0].entityId,
          entityType: this.ctx.datasources[0].entityType
        }).pipe(
          // @ts-ignore
          mergeMap((relations) => {
            if (!relations.length || !relations[0] || !relations[0].to) {
              this.dialogRef.close(false);
            }
            this.schedulerEvent.configuration.originatorId = relations[0].to;
            this.schedulerEvent.configuration.metadata = {
              deviceId: this.ctx.datasources[0].entityId
            };
            return this.schedulerEventService.saveSchedulerEvent(this.deepTrim(this.schedulerEvent));
          })
        ).subscribe(() => {
          this.dialogRef.close(true);
        });
      } else {
        const pageLink = new PageLink(1);
        this.entityViewService.getUserEntityViews(pageLink).pipe(
          // @ts-ignore
          mergeMap((res) => {
            if (!res.data.length) {
              this.dialogRef.close(false);
            }
            this.schedulerEvent.configuration.originatorId = res.data[0].id;
            this.schedulerEvent.configuration.metadata = {
              deviceId: res.data[0].entityId.id
            };
            return this.schedulerEventService.saveSchedulerEvent(this.deepTrim(this.schedulerEvent));
          })
        ).subscribe(() => {
          this.dialogRef.close(true);
        });
      }
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
