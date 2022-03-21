///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { SolchipSensorLatestCardModule } from './components/solchip-sensor-latest-card/solchip-sensor-latest-card.module';
import { SharedModule } from '@shared/public-api';
import { HomeComponentsModule } from '@home/components/public-api';
import {IrrigationControlTableModule} from "./components/irrigation-control-table/irrigation-control-table.module";
import {MatInputModule} from "@angular/material/input";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSortModule} from "@angular/material/sort";
import {FormsModule} from "@angular/forms";
import {MatTableModule} from "@angular/material/table";

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule,
    MatInputModule,
    CommonModule,
    SharedModule,
    HomeComponentsModule,
    TranslateModule,
    MatProgressSpinnerModule,
    MatSortModule,
    FormsModule,
    MatTableModule
  ],
  exports: [
    SolchipSensorLatestCardModule,
    IrrigationControlTableModule
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
