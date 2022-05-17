///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { TbIngramChartGaugeModule } from './components/tb-ingram-chart-gauge/tb-ingram-chart-gauge.module';
import { SharedModule } from '@shared/public-api';
import {TbIngramAlarmChartModule} from "./components/tb-ingram-alarm-chart/tb-ingram-alarm-chart.module";

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: [
    TbIngramChartGaugeModule,
    TbIngramAlarmChartModule,
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
