///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerEventsComponent } from './scheduler-events.component';
import { SharedModule } from '@shared/public-api';

@NgModule({
  declarations: [
    SchedulerEventsComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports: [
    SchedulerEventsComponent
  ]
})
export class SchedulerEventsModule {
}
