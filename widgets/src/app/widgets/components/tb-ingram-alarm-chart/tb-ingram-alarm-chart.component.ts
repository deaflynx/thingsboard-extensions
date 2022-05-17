///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {AfterViewInit, Component, ElementRef, Input, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {SenecaFlot} from './customFlot/flot-widget';

@Component({
  selector: 'tb-ingram-alarm-chart',
  templateUrl: './tb-ingram-alarm-chart.component.html',
  styleUrls: ['./tb-ingram-alarm-chart.component.scss']
})
export class TbIngramAlarmChartComponent implements AfterViewInit, OnInit {

  @ViewChild('Chart') chart: ElementRef;


  @Input()
  ctx: any;

  flot: SenecaFlot;

  @Input()
  alarmService: any;

  constructor() {
  }



  ngOnInit() {

  }

  ngAfterViewInit() {
    this.ctx.flot = new SenecaFlot(this.ctx, 'line', $(this.chart.nativeElement));
  }
}
