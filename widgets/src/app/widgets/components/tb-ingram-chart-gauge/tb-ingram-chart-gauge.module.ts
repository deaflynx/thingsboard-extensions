///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TbIngramChartGaugeComponent} from './tb-ingram-chart-gauge.component';
import {HomeComponentsModule} from "@home/components/public-api";
import {SharedModule} from "@shared/public-api";
import {LegendCustomComponent} from "./customLegend/legend.component";

@NgModule({
  declarations: [
    TbIngramChartGaugeComponent,
    LegendCustomComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule
  ],
  exports: [
    TbIngramChartGaugeComponent,
    LegendCustomComponent
  ]
})
export class TbIngramChartGaugeModule {
}
