///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExampleComponent } from './example.component';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';

@NgModule({
  declarations: [
    ExampleComponent
  ],
  imports: [
    CommonModule,
    ButtonModule,
    AccordionModule
  ],
  exports: [
    ExampleComponent
  ]
})
export class ExampleModule {
}
