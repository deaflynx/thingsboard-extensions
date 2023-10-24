///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {IrrigationControlTableComponent} from "./irrigation-control-table.component";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatIconModule} from "@angular/material/icon";
import {MatFormFieldModule} from "@angular/material/form-field";
import {ExtendedModule, FlexModule} from "@angular/flex-layout";
import {FormsModule} from "@angular/forms";
import {TranslateModule} from "@ngx-translate/core";
import {MatTableModule} from "@angular/material/table";
import {MatSortModule} from "@angular/material/sort";
import {MatMenuModule} from "@angular/material/menu";
import {MatDividerModule} from "@angular/material/divider";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatInputModule} from "@angular/material/input";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatButtonModule} from "@angular/material/button";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";

@NgModule({
  declarations: [
    IrrigationControlTableComponent
  ],
    imports: [
        CommonModule,
        MatToolbarModule,
        MatTooltipModule,
        MatIconModule,
        MatFormFieldModule,
        ExtendedModule,
        FormsModule,
        TranslateModule,
        MatTableModule,
        MatSortModule,
        MatMenuModule,
        MatDividerModule,
        MatPaginatorModule,
        MatInputModule,
        MatCheckboxModule,
        MatButtonModule,
        FlexModule,
        MatSlideToggleModule
    ],
  exports: [
    IrrigationControlTableComponent
  ]
})
export class IrrigationControlTableModule {
}
