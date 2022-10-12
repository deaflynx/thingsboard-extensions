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
import {tbMigrationModule} from "./components/tb-migration/tb-migration.module";
import {tbMigrationCustomerModule} from "./components/tb-migration-customer/tb-migration-customer.module";

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
    tbMigrationModule,
    tbMigrationCustomerModule,
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
