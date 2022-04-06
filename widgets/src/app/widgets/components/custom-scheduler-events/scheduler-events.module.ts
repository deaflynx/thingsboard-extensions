///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerEventsComponent } from './scheduler-events.component';
import { SharedModule } from '@shared/public-api';
import { SchedulerEventDialogComponent } from './scheduler-event-dialog.component';

@NgModule({
  declarations: [
    SchedulerEventsComponent,
    SchedulerEventDialogComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports: [
    SchedulerEventsComponent,
    SchedulerEventDialogComponent
  ]
})
export class SchedulerEventsModule {
}
