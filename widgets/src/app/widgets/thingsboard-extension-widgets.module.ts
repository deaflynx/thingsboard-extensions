///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { SharedModule } from '@shared/public-api';
import { HomeComponentsModule } from '@home/components/public-api';
import { LemFlotWidgetComponent } from './components/lem-threshold-flot/lem-flot-widget.component';
import { LemFlotLineWidgetSettingsComponent } from './components/lem-threshold-flot/lem-flot-line-widget-settings.component';
import { LemFlotWidgetSettingsComponent } from './components/lem-threshold-flot/lem-flot-widget-settings.component';
import { LemLabelDataKeyComponent } from './components/lem-threshold-flot/lem-label-data-key.component';

@NgModule({
  declarations: [
    LemFlotWidgetComponent,
    LemFlotLineWidgetSettingsComponent,
    LemFlotWidgetSettingsComponent,
    LemLabelDataKeyComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule
  ],
  exports: [
    LemFlotWidgetComponent,
    LemFlotLineWidgetSettingsComponent,
    LemFlotWidgetSettingsComponent,
    LemLabelDataKeyComponent
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
