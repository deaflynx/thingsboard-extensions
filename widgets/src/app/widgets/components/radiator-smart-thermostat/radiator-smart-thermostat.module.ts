///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/public-api';
import { RadiatorSmartThermostatComponent } from './radiator-smart-thermostat.component';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';

@NgModule({
  declarations: [
    RadiatorSmartThermostatComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ButtonModule,
    AccordionModule
  ],
  exports: [
    RadiatorSmartThermostatComponent
  ]
})
export class RadiatorSmartThermostatModule {
}
