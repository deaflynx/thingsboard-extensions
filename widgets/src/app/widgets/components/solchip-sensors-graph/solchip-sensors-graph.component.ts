///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { Component, Input, OnInit } from '@angular/core';
import {
  DatasourceType,
  EntityType,
  WidgetConfig,
  widgetType
} from '@shared/public-api';
import {
  IWidgetSubscription,
  SubscriptionInfo,
  WidgetSubscriptionOptions
} from '@core/public-api';
import { WidgetContext } from '@home/models/widget-component.models';
import { StateParams } from '@core/api/widget-api.models';

@Component({
  selector: 'solchip-sensor-latest-card',
  templateUrl: './solchip-sensors-graph.component.html',
  styleUrls: ['./solchip-sensors-graph.component.scss']
})
export class SolchipSensorsGraphComponent implements OnInit {

  @Input()
  ctx: WidgetContext;

  public value: number = 0;
  public measurementUnit: string;
  public timestamp: number;

  private widgetConfig: WidgetConfig;
  private subscription: IWidgetSubscription;

  private subscriptionOptions: WidgetSubscriptionOptions = {
    callbacks: {
      onDataUpdated: (subscription, detectChanges) => this.ctx.ngZone.run(() => {
        this.onDataUpdated(subscription, detectChanges);
      }),
      dataLoading: () => {}
    }
  };

  constructor() { }

  ngOnInit() {
    this.widgetConfig = this.ctx.widgetConfig;
    const stateParams: StateParams = this.ctx?.stateController?.getStateParams();
    /*this.createSensorSubscription(stateParams);
    this.setUnit(stateParams.measurementUnit);*/
  }

  private setUnit(measurementUnit: string) {
    if (this.measurementUnit !== measurementUnit) {
      this.measurementUnit = measurementUnit;
    }
  }

  public onDataUpdated(subscription: IWidgetSubscription, detectChanges: boolean = true) {
    let value;
    const data = subscription.data;
    if (data.length) {
      const keyData = data[0];
      if (keyData?.data[0]) {
        value = keyData.data[0][1];
        this.timestamp = keyData.data[0][0];
      }
    }
    if (value) {
      this.setValue(value);
    }
    if (detectChanges) {
      this.ctx.detectChanges();
    }
  }

  private setValue(value: number) {
    if (this.value !== value) {
      this.value = value;
    }
  }

  private createSensorSubscription(stateParams: StateParams) {
    const subscriptionsInfo: SubscriptionInfo[] = [{
      type: DatasourceType.entity,
      entityType: stateParams.entityId.entityType as EntityType,
      entityId: stateParams.entityId.id
    }];
    subscriptionsInfo[0].timeseries = [{
      name: stateParams.keyToPropagate
    }];
    this.ctx.subscriptionApi.createSubscriptionFromInfo(widgetType.latest, subscriptionsInfo, this.subscriptionOptions, false, true).subscribe(
      subscription => {
        this.subscription = subscription;
      }
    );
  }
}
