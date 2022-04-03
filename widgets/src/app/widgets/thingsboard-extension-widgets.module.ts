///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { ExampleModule } from './components/example/example.module';
import { SharedModule } from '@shared/public-api';
import { HomeComponentsModule } from '@home/components/public-api';
import { ExampleMap } from './components/map/example-map.component';
import { CustomAlarmsTableWidgetComponent } from './components/alarm/custom-alarms-table-widget.component';
import { SchedulerEventsComponent } from './components/custom-scheduler-events/scheduler-events.component';

@NgModule({
  declarations: [
    ExampleMap,
    CustomAlarmsTableWidgetComponent,
    SchedulerEventsComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule
  ],
  exports: [
    ExampleMap,
    ExampleModule,
    CustomAlarmsTableWidgetComponent,
    SchedulerEventsComponent
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
