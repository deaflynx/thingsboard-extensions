///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerEventsComponent } from './scheduler-events.component';
import { SharedModule } from '@shared/public-api';
import { SchedulerEventDialogComponent } from './scheduler-event-dialog.component';
import { SchedulerEventConfigComponent } from './scheduler-event-config.component';
import { SchedulerEventTypeAutocompleteComponent } from './scheduler-event-type-autocomplete.component';
import { SchedulerEventScheduleComponent } from './scheduler-event-schedule.component';

@NgModule({
  declarations: [
    SchedulerEventsComponent,
    SchedulerEventDialogComponent,
    SchedulerEventConfigComponent,
    SchedulerEventTypeAutocompleteComponent,
    SchedulerEventScheduleComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports: [
    SchedulerEventsComponent,
    SchedulerEventDialogComponent,
    SchedulerEventConfigComponent,
    SchedulerEventTypeAutocompleteComponent,
    SchedulerEventScheduleComponent
  ]
})
export class SchedulerEventsModule {
}
