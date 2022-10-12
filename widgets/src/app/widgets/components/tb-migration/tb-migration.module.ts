///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TbMigrationComponent} from "./tb-migration.component";
import {HomeComponentsModule} from "@home/components/public-api";
import {SharedModule} from "@shared/public-api";

@NgModule({
  declarations: [
    TbMigrationComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule,
  ],
  exports: [
    TbMigrationComponent
  ]
})
export class tbMigrationModule {
}
