///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TbIngramAlarmChartComponent} from './tb-ingram-alarm-chart.component';
import {HomeComponentsModule} from "@home/components/public-api";
import {SharedModule} from "@shared/public-api";

@NgModule({
  declarations: [
    TbIngramAlarmChartComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule
  ],
  exports: [
    TbIngramAlarmChartComponent
  ]
})
export class TbIngramAlarmChartModule {
}
