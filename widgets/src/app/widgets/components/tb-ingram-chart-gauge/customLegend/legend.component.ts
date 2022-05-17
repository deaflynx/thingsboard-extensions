///
/// Copyright © 2021 ThingsBoard, Inc.
///

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

export interface LegendKey {
  dataKey: DataKey;
  dataIndex: number;
}

export interface LegendKeyData {
  min: string;
  max: string;
  avg: string;
  total: string;
  hidden: boolean;
}

export interface LegendData {
  keys: Array<LegendKey>;
  data: Array<LegendKeyData>;
}

enum DataKeyType {
  timeseries = 'timeseries',
  attribute = 'attribute',
  function = 'function',
  alarm = 'alarm',
  entityField = 'entityField',
  count = 'count'
}

enum widgetType {
  timeseries = 'timeseries',
  latest = 'latest',
  rpc = 'rpc',
  alarm = 'alarm',
  static = 'static'
}

export enum LegendDirection {
  column = 'column',
  row = 'row'
}

export enum LegendPosition {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right'
}


export interface LegendConfig {
  position: LegendPosition;
  direction?: LegendDirection;
  sortDataKeys: boolean;
  showMin: boolean;
  showMax: boolean;
  showAvg: boolean;
  showTotal: boolean;
}


interface KeyInfo {
  name: string;
  label?: string;
  color?: string;
  funcBody?: string;
  postFuncBody?: string;
  units?: string;
  decimals?: number;
}

interface DataKey extends KeyInfo {
  type: DataKeyType;
  pattern?: string;
  settings?: any;
  usePostProcessing?: boolean;
  hidden?: boolean;
  inLegend?: boolean;
  isAdditional?: boolean;
  origDataKeyIndex?: number;
  _hash?: number;
}

enum DatasourceType {
  function = 'function',
  entity = 'entity',
  entityCount = 'entityCount'
}

@Component({
  selector: 'tb-seneca-legend ',
  templateUrl: './legend.component.html',
  styleUrls: ['./legend.component.scss']
})
export class LegendCustomComponent implements OnInit {

  @Input()
  legendConfig: LegendConfig;

  @Input()
  legendData: LegendData;

  @Output()
  legendKeyHiddenChange = new EventEmitter<number>();

  displayHeader: boolean;

  isHorizontal: boolean;

  isRowDirection: boolean;

  ngOnInit(): void {
    this.displayHeader = this.legendConfig.showMin === true ||
      this.legendConfig.showMax === true ||
      this.legendConfig.showAvg === true ||
      this.legendConfig.showTotal === true;

    this.isHorizontal = this.legendConfig.position === LegendPosition.bottom ||
      this.legendConfig.position === LegendPosition.top;

    this.isRowDirection = this.legendConfig.direction === LegendDirection.row;
  }

  toggleHideData(index: number) {
    const dataKey = this.legendData.keys.find(key => key.dataIndex === index).dataKey;
    if (!dataKey.settings.disableDataHiding) {
      dataKey.hidden = !dataKey.hidden;
      this.legendKeyHiddenChange.emit(index);
    }
  }

  legendKeys(): LegendKey[] {
    let keys = this.legendData.keys;
    if (this.legendConfig.sortDataKeys) {
      keys = this.legendData.keys.sort((key1, key2) => key1.dataKey.label.localeCompare(key2.dataKey.label));
    }
    return keys.filter(legendKey => this.legendData.keys[legendKey.dataIndex].dataKey.inLegend);
  }

}
