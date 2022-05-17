///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {AfterViewInit, Component, ElementRef, Input, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {SenecaFlot} from './customFlot/flot-widget';
import {LegendConfig, LegendDirection, LegendPosition} from "./customLegend/legend.component";
import {deepClone} from "./customFlot/utils";
import {FormControl} from "@angular/forms";
import {TooltipValueFormatFunction} from "../tb-ingram-alarm-chart/customFlot/flot-widget.models";


@Component({
  selector: 'tb-ingram-chart-gauge',
  templateUrl: './tb-ingram-chart-gauge.component.html',
  styleUrls: ['./tb-ingram-chart-gauge.component.scss']
})
export class TbIngramChartGaugeComponent implements AfterViewInit, OnInit {

  @ViewChild('Chart') chart: ElementRef;

  @ViewChildren("gauges") gauges: QueryList<ElementRef>;

  @Input()
  ctx: any;

  flot: SenecaFlot;
  gaugesArray: Array<any> = [];
  gaugesCtxArray: Array<any> = [];

  legendStyle = {
    paddingBottom: '8px',
    maxHeight: '50%',
    overflowY: 'auto'
  };

  legendConfig: LegendConfig = {
    direction: LegendDirection.column,
    position: LegendPosition.bottom,
    sortDataKeys: true,
    showMin: false,
    showMax: false,
    showAvg: true,
    showTotal: false
  };

  layoutConfig: any = {
  }

  resizeDebounce = new FormControl();

  legendData = {
    keys: [],
    data: []
  };

  private $container: any;

  private processPattern(template: string, data: {
    data: { any }, datasource: {
      entityLabel: string;
      entityName: string;
      any
    }, dataKey: {
      label: string;
      any
    }
  }): string {
    if (template.includes('${entityName}')) {
      template = template.replace('${entityName}', data.datasource.entityName)
    }
    if (template.includes('${entityLabel}')) {
      template = template.replace('${entityLabel}', data.datasource.entityLabel)
    }
    if (template.includes('${dataKeyName}')) {
      template = template.replace('${dataKeyName}', data.dataKey.label)
    }
    return template;
  }

  constructor() {
  }

  public onLegendKeyHiddenChange(index: number) {
    for (const id of Object.keys(this.ctx.subscriptions)) {
      const subscription = this.ctx.subscriptions[id];
      if (subscription.type === "timeseries") this.updateDataVisibility(subscription, index);
    }
  }

  private gaugesContainerResize() {
      if (!this.ctx.settings.useGaugesGrid) {
        let width = 0;
        width = this.gauges.last.nativeElement.offsetWidth + this.gauges.last.nativeElement.offsetLeft + this.layoutConfig.gaugesSpacing;
        this.layoutConfig.gaugesWidth = this.gauges.last.nativeElement.offsetWidth + "px";
        this.layoutConfig.gaugesContainerWidth = width + "px";
        // this.ctx.detectChanges();
      }
    }

    private calculateDefaultSizes() {
      this.legendConfig.showAvg = !!this.ctx.settings.displayLegendAvg;
      this.legendConfig.showMax = !!this.ctx.settings.displayLegendMax;
      this.legendConfig.showMin = !!this.ctx.settings.displayLegendMin;
      this.legendConfig.showTotal = !!this.ctx.settings.displayLegendTotal;
      this.layoutConfig.dynamicGrid = !!this.ctx.settings.dynamicGrid;
      this.layoutConfig.gaugesSpacing = this.ctx.settings.gaugesSpacing || 0;
      this.layoutConfig.columnLaoutHeight = "calc("+ (this.ctx.settings.columnLaoutHeight || "100%")+" - " + this.layoutConfig.gaugesSpacing*2 + "px)";
      this.layoutConfig.chartContainerWidth = this.ctx.settings.gaugesContainerWidth || "50%";
      this.layoutConfig.gaugesContainerWidth = `calc(100% - ${this.layoutConfig.chartContainerWidth})`;
      this.layoutConfig.gaugesWidth = "calc("+  (this.ctx.settings.gaugesWidth || "50%") +" - " + this.layoutConfig.gaugesSpacing*2 + "px)";
      if (this.ctx.settings.useGaugesGrid) {
        this.layoutConfig.columnLaoutHeight = "calc("+  (100/this.ctx.settings.gaugesRows) +"% - " + this.layoutConfig.gaugesSpacing*2 + "px)";
        this.layoutConfig.gaugesWidth = "calc("+  (100/this.ctx.settings.gaugesColumns) +"% - " + this.layoutConfig.gaugesSpacing*2 + "px)";
      }
      if (this.layoutConfig.dynamicGrid && this.ctx.settings.gauges) {
        let gaugesAmount = this.ctx.settings.gauges.length * this.ctx.defaultSubscription.datasources.length;
        if (gaugesAmount <= 3) {
          this.layoutConfig.gaugesWidth = "calc(100% - " + this.layoutConfig.gaugesSpacing * 2 + "px)"
          this.layoutConfig.columnLaoutHeight = "calc(" + (100 / gaugesAmount) + "% - " + this.layoutConfig.gaugesSpacing * 2 + "px)";
        } else {
          if (gaugesAmount % 3 === 0) {
            this.layoutConfig.gaugesWidth = "calc(33% - " + this.layoutConfig.gaugesSpacing * 2 + "px)"
            this.layoutConfig.columnLaoutHeight = "calc(" + (100 / gaugesAmount * 3) + "% - " + this.layoutConfig.gaugesSpacing * 2 + "px)";
          } else if (gaugesAmount % 2 === 0) {
            this.layoutConfig.gaugesWidth = "calc(50% - " + this.layoutConfig.gaugesSpacing * 2 + "px)"
            this.layoutConfig.columnLaoutHeight = "calc(" + (100 / gaugesAmount * 2) + "% - " + this.layoutConfig.gaugesSpacing * 2 + "px)";
          } else {
            this.layoutConfig.gaugesWidth = "calc(33% - " + this.layoutConfig.gaugesSpacing * 2 + "px)";
            this.layoutConfig.columnLaoutHeight = "calc(" + (100 / Math.ceil(gaugesAmount / 3)) + "% - " + this.layoutConfig.gaugesSpacing * 2 + "px)";
            }
          }
        }
    }


  updateDataVisibility(subscription: any, index: number): void {
    const hidden = this.legendData.keys.find(key => key.dataIndex === index).dataKey.hidden;
    if (hidden) {
      subscription.hiddenData[index].data = subscription.data[index].data;
      subscription.data[index].data = [];
    } else {
      subscription.data[index].data = subscription.hiddenData[index].data;
      subscription.hiddenData[index].data = [];
    }
    subscription.onDataUpdated();
  }


  ngOnInit() {
    this.calculateDefaultSizes();
    if (this.ctx.settings.gauges && this.ctx.settings.gauges.length) {
      this.ctx.defaultSubscription.datasources.forEach(ds => {
        this.ctx.settings.gauges.forEach((gauge, index) => {
          let gaugeCtx = {
            settings: gauge,
            data: this.ctx.data.filter(data=>ds.entityId === data.datasource.entityId),
            decimals: this.ctx.decimals,
            units: this.ctx.units,
            isMobile: this.ctx.isMobile,
            aliasController: this.ctx.aliasController,
            subscriptionApi: this.ctx.subscriptionApi,
            $injector: this.ctx.$injector,
            // width: $(this.gauges.toArray()[index].nativeElement).width(),
            // height: $(this.gauges.toArray()[index].nativeElement).height(),
            hidden: false
          };
          this.gaugesCtxArray.push(gaugeCtx);
        })
      })
    }
  }

  ngAfterViewInit() {
    const calculateLegendData = (ctxData: any, showLegend: boolean) => {
      let keys = [];
      let data = [];
      if (ctxData && showLegend) ctxData.forEach((dKdata, index) => {
        if (dKdata.data) {
          let key = {
            dataIndex: index,
            dataKey: dKdata.dataKey
          }
          keys.push(key);
          let legendData = {
            avg: "",
            hidden: dKdata.dataKey.hidden,
            max: "",
            min: "",
            total: ""
          };

          let rawData = dKdata.data.map(el => el[1]);
          legendData.min = Math.min(...deepClone(rawData)).toFixed(2) + "";
          legendData.max = Math.max(...deepClone(rawData)).toFixed(2) + "";
          legendData.avg = deepClone(rawData).reduce((a, b) => a + b, 0).toFixed(2) + "";
          legendData.total = (+legendData.avg / deepClone(rawData).length).toFixed(2) + "";
          if (dKdata?.data?.length === 0 && this.legendData?.data && this.legendData?.data[index]) {
            legendData = this.legendData.data[index];
            legendData.hidden = dKdata.dataKey.hidden;
          }
          if (legendData.hidden) {
            dKdata.data = [];
          }
          data.push(legendData);
        }
      })
      this.legendData = {
        keys,
        data
      }
      this.ctx.detectChanges();
      this.ctx.flot?.resize();
    }
    this.ctx.calculateLegendData = calculateLegendData;
    this.gaugesCtxArray.forEach((gaugeCtx, index) => {
      let gauge = gaugeCtx.settings;
      const dataKey = {
        type: gauge.attributeType || "attribute",
        name: gauge.attributeName,
        label: gauge.attributeName,
        settings: [],
        _hash: Math.random()
      };

      const datasourceAttribute = {
        type: "entity",
        name: this.ctx.datasources[0].aliasName,
        aliasName: this.ctx.datasources[0].aliasName,
        entityAliasId: this.ctx.datasources[0].entityAliasId,
        dataKeys: [dataKey]
      };
      const gaugeAttrSubscriptionOptions = {
        datasources: [datasourceAttribute],
        useDashboardTimewindow: false,
        type: "latest",
        callbacks: {
          onDataUpdated: (subscription) => {
            gaugeCtx.data = subscription.data;
            updateGauge();
            getGauges()[index].update();
            if (gaugeCtx.settings.useCustomLabel) {
              let gaugeCtx = this.gaugesCtxArray[index];
              let labelFn = null;
              try {
                labelFn = new Function("data", "dsData", gaugeCtx.settings.customLabelFunction);
                getGauges()[index].gauge.options.label = labelFn(subscription.data[0], subscription.datasource);
                getGauges()[index].update();
              } catch (e) {
                labelFn = null;
              }
            }
            setTimeout(function () {
              let gauge = getGauges()[index].gauge;
              const valueColor = gauge.getValueColor();
              gauge.options.colorLabel = valueColor;
              gauge.options.colorMinMax = valueColor;
              gauge.options.colorValue = valueColor;
              gauge.update();
            }, this.gaugesCtxArray[index].settings.animation ? this.gaugesCtxArray[index].settings.animationDuration : 0);
            getGauges()[index].update();
          }
        }
      }
      const updateGauge = () => {
        let gaugeCtx = this.gaugesCtxArray[index];
        if (gauge.title) gaugeCtx.settings.title = this.processPattern(gauge.title, gaugeCtx.data[0]);
        this.gaugesCtxArray[index].hidden = gaugeCtx.data[0]?.data[0] && gaugeCtx.data[0]?.data[0][0] === 0;
        this.ctx.detectChanges();
      }
      gaugeCtx.subscriptionApi.createSubscription(gaugeAttrSubscriptionOptions, true);
      updateGauge();
      gaugeCtx.$container = $(this.gauges.toArray()[index].nativeElement)
      gaugeCtx.width = $(this.gauges.toArray()[index].nativeElement).width()
      gaugeCtx.height = $(this.gauges.toArray()[index].nativeElement).height()
      // @ts-ignore
      this.gaugesArray.push(new window.TbCanvasDigitalGauge(gaugeCtx, 'gauge_' + index));
    })
    calculateLegendData(this.ctx.data, this.ctx.settings.displayChartLegend);
    this.ctx.flot = new SenecaFlot(this.ctx, 'line', $(this.chart.nativeElement))
    const getGauges = () => this.gaugesArray;
    const getGaugesRef = () => this.gauges;

    this.ctx.gauges = {};
    this.ctx.gauges.update = function () {
      if (getGauges().length) getGauges().forEach(gauge => gauge.update && gauge.update());
    }
    this.ctx.gauges.resize = () =>{
      if (getGauges().length) getGauges().forEach((gauge, index) => {
        gauge.ctx.width = $(getGaugesRef().toArray()[index].nativeElement).width();
        gauge.ctx.height = $(getGaugesRef().toArray()[index].nativeElement).height();
        gauge.resize && gauge.resize()
      });

    }
  }
}
