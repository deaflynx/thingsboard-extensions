///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/public-api';
import { RadiatorSmartThermostatComponent } from './radiator-smart-thermostat.component';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { RadiatorSmartThermostatV2Component } from './radiator-smart-thermostat-v2.component';

@NgModule({
  declarations: [
    RadiatorSmartThermostatComponent,
    RadiatorSmartThermostatV2Component
  ],
  imports: [
    CommonModule,
    SharedModule,
    ButtonModule,
    AccordionModule
  ],
  exports: [
    RadiatorSmartThermostatComponent,
    RadiatorSmartThermostatV2Component
  ]
})
export class RadiatorSmartThermostatModule {
}
