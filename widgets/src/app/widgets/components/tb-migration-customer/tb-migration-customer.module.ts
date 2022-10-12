///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TbMigrationCustomerComponent} from "./tb-migration-customer.component";
import {HomeComponentsModule} from "@home/components/public-api";
import {SharedModule} from "@shared/public-api";

@NgModule({
  declarations: [
    TbMigrationCustomerComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule,
  ],
  exports: [
    TbMigrationCustomerComponent
  ]
})
export class tbMigrationCustomerModule {
}
