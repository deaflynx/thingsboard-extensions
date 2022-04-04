///
/// ThingsBoard, Inc. ("COMPANY") CONFIDENTIAL
///
/// Copyright © 2016-2022 ThingsBoard, Inc. All Rights Reserved.
///
/// NOTICE: All information contained herein is, and remains
/// the property of ThingsBoard, Inc. and its suppliers,
/// if any.  The intellectual and technical concepts contained
/// herein are proprietary to ThingsBoard, Inc.
/// and its suppliers and may be covered by U.S. and Foreign Patents,
/// patents in process, and are protected by trade secret or copyright law.
///
/// Dissemination of this information or reproduction of this material is strictly forbidden
/// unless prior written permission is obtained from COMPANY.
///
/// Access to the source code contained herein is hereby forbidden to anyone except current COMPANY employees,
/// managers or contractors who have executed Confidentiality and Non-disclosure agreements
/// explicitly covering such access.
///
/// The copyright notice above does not evidence any actual or intended publication
/// or disclosure  of  this source code, which includes
/// information that is confidential and/or proprietary, and is a trade secret, of  COMPANY.
/// ANY REPRODUCTION, MODIFICATION, DISTRIBUTION, PUBLIC  PERFORMANCE,
/// OR PUBLIC DISPLAY OF OR THROUGH USE  OF THIS  SOURCE CODE  WITHOUT
/// THE EXPRESS WRITTEN CONSENT OF COMPANY IS STRICTLY PROHIBITED,
/// AND IN VIOLATION OF APPLICABLE LAWS AND INTERNATIONAL TREATIES.
/// THE RECEIPT OR POSSESSION OF THIS SOURCE CODE AND/OR RELATED INFORMATION
/// DOES NOT CONVEY OR IMPLY ANY RIGHTS TO REPRODUCE, DISCLOSE OR DISTRIBUTE ITS CONTENTS,
/// OR TO MANUFACTURE, USE, OR SELL ANYTHING THAT IT  MAY DESCRIBE, IN WHOLE OR IN PART.
///

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { PageComponent } from '@shared/public-api';
import { Store } from '@ngrx/store';
import { AppState } from '@core/public-api';
import { WidgetContext } from '@home/models/widget-component.models';
import { UserPermissionsService } from '@core/public-api';
import { Authority } from '@shared/public-api';
import {
  SchedulerEvent,
  SchedulerEventWithCustomerInfo,
  SchedulerRepeatType,
  schedulerRepeatTypeToUnitMap,
  schedulerTimeUnitRepeatTranslationMap,
  schedulerWeekday
} from './scheduler-event.models';
import { CollectionViewer, DataSource, SelectionModel } from '@angular/cdk/collections';
import { BehaviorSubject, forkJoin, fromEvent, merge, Observable, of, ReplaySubject } from 'rxjs';
import { emptyPageData, PageData } from '@shared/public-api';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  publishReplay,
  refCount,
  share,
  skip,
  take,
  tap
} from 'rxjs/operators';
import { PageLink, PageQueryParam } from '@shared/public-api';
import { SchedulerEventService } from '@core/public-api';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, SortDirection } from '@angular/material/sort';
import { Direction, SortOrder, sortOrderFromString } from '@shared/public-api';
import { UtilsService } from '@core/public-api';
import { TranslateService } from '@ngx-translate/core';
import { deepClone, isDefined, isEmptyStr, isNotEmptyStr, isNumber } from '@core/public-api';
import { MatDialog } from '@angular/material/dialog';
import {
  SchedulerEventDialogComponent,
  SchedulerEventDialogData
} from '@home/components/scheduler/scheduler-event-dialog.component';
import { DialogService } from '@core/public-api';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import momentPlugin, { toMoment } from '@fullcalendar/moment';
import interactionPlugin from '@fullcalendar/interaction';
import { FullCalendarComponent } from '@fullcalendar/angular';
import {
  schedulerCalendarView,
  schedulerCalendarViewTranslationMap,
  schedulerCalendarViewValueMap,
  SchedulerEventsWidgetSettings
} from './scheduler-events.models';
import { Calendar, DateClickApi } from '@fullcalendar/core/Calendar';
import { asRoughMs, Duration, EventInput, rangeContainsMarker } from '@fullcalendar/core';
import { EventSourceError, EventSourceInput } from '@fullcalendar/core/structs/event-source';
import * as _moment from 'moment';
import { MatMenuTrigger } from '@angular/material/menu';
import { EventHandlerArg } from '@fullcalendar/core/types/input-types';
import { getUserZone } from '@shared/models/time/time.models';
import { ActivatedRoute, QueryParamsHandling, Router } from '@angular/router';
import {
  AddEntitiesToEdgeDialogComponent,
  AddEntitiesToEdgeDialogData
} from '@home/dialogs/add-entities-to-edge-dialog.component';
import { EntityType } from '@shared/models/entity-type.models';
import { ResizeObserver } from '@juggle/resize-observer';
import { hidePageSizePixelValue } from '@shared/public-api';
import { AuthUser } from '@shared/public-api';
import { defaultSchedulerEventConfigTypes, SchedulerEventConfigType } from './scheduler-event-config.models';

export enum Resource {
  ALL = "ALL",
  PROFILE = "PROFILE",
  ADMIN_SETTINGS = "ADMIN_SETTINGS",
  ALARM = "ALARM",
  DEVICE = "DEVICE",
  DEVICE_PROFILE = "DEVICE_PROFILE",
  ASSET = "ASSET",
  CUSTOMER = "CUSTOMER",
  DASHBOARD = "DASHBOARD",
  ENTITY_VIEW = "ENTITY_VIEW",
  TENANT = "TENANT",
  TENANT_PROFILE = "TENANT_PROFILE",
  RULE_CHAIN = "RULE_CHAIN",
  USER = "USER",
  WIDGETS_BUNDLE = "WIDGETS_BUNDLE",
  WIDGET_TYPE = "WIDGET_TYPE",
  CONVERTER = "CONVERTER",
  INTEGRATION = "INTEGRATION",
  SCHEDULER_EVENT = "SCHEDULER_EVENT",
  BLOB_ENTITY = "BLOB_ENTITY",
  CUSTOMER_GROUP = "CUSTOMER_GROUP",
  DEVICE_GROUP = "DEVICE_GROUP",
  ASSET_GROUP = "ASSET_GROUP",
  USER_GROUP = "USER_GROUP",
  ENTITY_VIEW_GROUP = "ENTITY_VIEW_GROUP",
  DASHBOARD_GROUP = "DASHBOARD_GROUP",
  ROLE = "ROLE",
  GROUP_PERMISSION = "GROUP_PERMISSION",
  WHITE_LABELING = "WHITE_LABELING",
  AUDIT_LOG = "AUDIT_LOG",
  API_USAGE_STATE = "API_USAGE_STATE",
  TB_RESOURCE = "TB_RESOURCE",
  EDGE = "EDGE",
  EDGE_GROUP = "EDGE_GROUP",
  OTA_PACKAGE = "OTA_PACKAGE"
}
export enum Operation {
  ALL = "ALL",
  CREATE = "CREATE",
  READ = "READ",
  WRITE = "WRITE",
  DELETE = "DELETE",
  RPC_CALL = "RPC_CALL",
  READ_CREDENTIALS = "READ_CREDENTIALS",
  WRITE_CREDENTIALS = "WRITE_CREDENTIALS",
  READ_ATTRIBUTES = "READ_ATTRIBUTES",
  WRITE_ATTRIBUTES = "WRITE_ATTRIBUTES",
  READ_TELEMETRY = "READ_TELEMETRY",
  WRITE_TELEMETRY = "WRITE_TELEMETRY",
  ADD_TO_GROUP = "ADD_TO_GROUP",
  REMOVE_FROM_GROUP = "REMOVE_FROM_GROUP",
  CHANGE_OWNER = "CHANGE_OWNER",
  IMPERSONATE = "IMPERSONATE",
  CLAIM_DEVICES = "CLAIM_DEVICES",
  SHARE_GROUP = "SHARE_GROUP",
  ASSIGN_TO_TENANT = "ASSIGN_TO_TENANT"
}

@Component({
  selector: 'custom-scheduler-events',
  templateUrl: './scheduler-events.component.html',
  styleUrls: ['./scheduler-events.component.scss']
})
export class SchedulerEventsComponent extends PageComponent implements OnInit {

  @ViewChild('schedulerEventWidgetContainer', {static: true}) schedulerEventWidgetContainerRef: ElementRef;
  @ViewChild('searchInput') searchInputField: ElementRef;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  @ViewChild('calendarContainer') calendarContainer: ElementRef<HTMLElement>;
  @ViewChild('calendar') calendarComponent: FullCalendarComponent;

  @ViewChild('schedulerEventMenuTrigger', {static: true}) schedulerEventMenuTrigger: MatMenuTrigger;

  @Input()
  widgetMode: boolean;

  @Input()
  ctx: WidgetContext;

  settings: SchedulerEventsWidgetSettings;

  editEnabled = this.userPermissionsService.hasGenericPermission(Resource.SCHEDULER_EVENT, Operation.WRITE);
  addEnabled = this.userPermissionsService.hasGenericPermission(Resource.SCHEDULER_EVENT, Operation.CREATE);
  deleteEnabled = this.userPermissionsService.hasGenericPermission(Resource.SCHEDULER_EVENT, Operation.DELETE);

  authUser: AuthUser;

  showData = true;

  mode = 'list';

  displayCreatedTime = true;
  displayType = true;
  displayCustomer = true;

  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};

  displayPagination = true;
  pageSizeOptions;
  defaultPageSize = 10;
  defaultSortOrder = 'createdTime';
  defaultEventType: string;
  hidePageSize = false;
  noDataDisplayMessageText: string;

  displayedColumns: string[];
  pageLink: PageLink;

  textSearchMode = false;

  assignEnabled = false;

  dataSource: SchedulerEventsDatasource;

  calendarPlugins = [interactionPlugin, momentPlugin, dayGridPlugin, listPlugin, timeGridPlugin];

  currentCalendarView = schedulerCalendarView.month;

  currentCalendarViewValue = schedulerCalendarViewValueMap.get(this.currentCalendarView);

  schedulerCalendarViews = Object.keys(schedulerCalendarView);
  schedulerCalendarViewTranslations = schedulerCalendarViewTranslationMap;

  // eventSources: EventSourceInput[] = [this.eventSourceFunction.bind(this)];

  calendarApi: Calendar;

  schedulerEventMenuPosition = { x: '0px', y: '0px' };

  schedulerContextMenuEvent: MouseEvent;

  private schedulerEvents: Array<SchedulerEventWithCustomerInfo> = [];

  private widgetResize$: ResizeObserver;

  constructor(protected store: Store<AppState>,
              private utils: UtilsService,
              public translate: TranslateService,
              private schedulerEventService: SchedulerEventService,
              private userPermissionsService: UserPermissionsService,
              private dialogService: DialogService,
              private dialog: MatDialog,
              private router: Router,
              private route: ActivatedRoute,
              private cd: ChangeDetectorRef) {
    super(store);
    console.log('store', store);
  }

  ngOnInit(): void {
    if (this.widgetMode) {
      this.ctx.$scope.schedulerEventsWidget = this;
    }
    if (this.showData && this.widgetMode) {
      this.settings = this.ctx.settings;
      this.initializeWidgetConfig();
      this.ctx.updateWidgetParams();
    } else {
      this.displayedColumns = ['createdTime', 'name', 'typeName', 'customerTitle', 'actions'];
      if (this.deleteEnabled) {
        this.displayedColumns.unshift('select');
      }
      const routerQueryParams: PageQueryParam = this.route.snapshot.queryParams;
      const sortOrder: SortOrder = {
        property: routerQueryParams?.property || this.defaultSortOrder,
        direction: routerQueryParams?.direction || Direction.ASC
      };
      this.pageSizeOptions = [this.defaultPageSize, this.defaultPageSize * 2, this.defaultPageSize * 3];
      this.pageLink = new PageLink(this.defaultPageSize, 0, null, sortOrder);
      if (routerQueryParams.hasOwnProperty('page')) {
        this.pageLink.page = Number(routerQueryParams.page);
      }
      if (routerQueryParams.hasOwnProperty('pageSize')) {
        this.pageLink.pageSize = Number(routerQueryParams.pageSize);
      }
      if (routerQueryParams.hasOwnProperty('textSearch') && !isEmptyStr(routerQueryParams.textSearch)) {
        this.textSearchMode = true;
        this.pageLink.textSearch = decodeURI(routerQueryParams.textSearch);
      }
      this.schedulerEventConfigTypes = deepClone(defaultSchedulerEventConfigTypes);
      this.dataSource = new SchedulerEventsDatasource(this.schedulerEventService, this.schedulerEventConfigTypes, this.route);
    }
    if (this.displayPagination) {
      this.widgetResize$ = new ResizeObserver(() => {
        const showHidePageSize = this.schedulerEventWidgetContainerRef.nativeElement.offsetWidth < hidePageSizePixelValue;
        if (showHidePageSize !== this.hidePageSize) {
          this.hidePageSize = showHidePageSize;
          this.cd.markForCheck();
        }
      });
      this.widgetResize$.observe(this.schedulerEventWidgetContainerRef.nativeElement);
    }
  }

  private initializeWidgetConfig() {
    this.ctx.widgetConfig.showTitle = false;
    this.ctx.widgetTitle = this.settings.title;
    const displayCreatedTime = isDefined(this.settings.displayCreatedTime) ? this.settings.displayCreatedTime : true;
    const displayType = isDefined(this.settings.displayType) ? this.settings.displayType : true;
    const displayCustomer = isDefined(this.settings.displayCustomer) ? this.settings.displayCustomer : true;

    this.displayedColumns = [];
    if (this.deleteEnabled) {
      this.displayedColumns.push('select');
    }
    if (displayCreatedTime) {
      this.displayedColumns.push('createdTime');
    }
    this.displayedColumns.push('name');
    if (displayType) {
      this.displayedColumns.push('typeName');
    }
    if (displayCustomer) {
      this.displayedColumns.push('customerTitle');
    }
    this.displayedColumns.push('actions');
    this.displayPagination = isDefined(this.settings.displayPagination) ? this.settings.displayPagination : true;
    const pageSize = this.settings.defaultPageSize;
    if (isDefined(pageSize) && isNumber(pageSize) && pageSize > 0) {
      this.defaultPageSize = pageSize;
    }
    this.pageSizeOptions = [this.defaultPageSize, this.defaultPageSize * 2, this.defaultPageSize * 3];
    if (this.settings.defaultSortOrder && this.settings.defaultSortOrder.length) {
      this.defaultSortOrder = this.settings.defaultSortOrder;
    }

    const noDataDisplayMessage = this.settings.noDataDisplayMessage;
    if (isNotEmptyStr(noDataDisplayMessage)) {
      this.noDataDisplayMessageText = this.utils.customTranslation(noDataDisplayMessage, noDataDisplayMessage);
    } else {
      this.noDataDisplayMessageText = this.translate.instant('scheduler.no-scheduler-events');
    }

    const sortOrder: SortOrder = sortOrderFromString(this.defaultSortOrder);
    if (sortOrder.property === 'type') {
      sortOrder.property = 'typeName';
    }
    if (sortOrder.property === 'customer') {
      sortOrder.property = 'customerTitle';
    }
    this.pageLink = new PageLink(this.defaultPageSize, 0, null, sortOrder);
    if (this.settings.forceDefaultEventType && this.settings.forceDefaultEventType.length) {
      this.defaultEventType = this.settings.forceDefaultEventType;
    }
    this.schedulerEventConfigTypes = deepClone(defaultSchedulerEventConfigTypes);
    if (this.settings.customEventTypes && this.settings.customEventTypes.length) {
      this.settings.customEventTypes.forEach((customEventType) => {
        this.schedulerEventConfigTypes[customEventType.value] = customEventType;
      });
    }
    if (this.settings.enabledViews !== 'both') {
      this.mode = this.settings.enabledViews;
    }
    this.ctx.widgetActions = [
      {
        name: 'scheduler.add-scheduler-event',
        show: this.addEnabled,
        icon: 'add',
        onAction: ($event) => {
          // this.addSchedulerEvent($event);
        }
      },
      {
        name: 'action.search',
        show: true,
        icon: 'search',
        onAction: () => {
          // this.enterFilterMode();
        }
      },
      {
        name: 'action.refresh',
        show: true,
        icon: 'refresh',
        onAction: () => {
          // this.reloadSchedulerEvents();
        }
      }
    ];
    this.dataSource = new SchedulerEventsDatasource(this.schedulerEventService, this.schedulerEventConfigTypes, this.route);
    this.dataSource.selection.changed.subscribe(() => {
      const hideTitlePanel = !this.dataSource.selection.isEmpty() || this.textSearchMode;
      if (this.ctx.hideTitlePanel !== hideTitlePanel) {
        this.ctx.hideTitlePanel = hideTitlePanel;
        this.ctx.detectChanges(true);
      } else {
        this.ctx.detectChanges();
      }
    });
  }
}

class SchedulerEventsDatasource implements DataSource<SchedulerEventWithCustomerInfo> {

  private entitiesSubject = new BehaviorSubject<SchedulerEventWithCustomerInfo[]>([]);
  private pageDataSubject = new BehaviorSubject<PageData<SchedulerEventWithCustomerInfo>>(emptyPageData<SchedulerEventWithCustomerInfo>());

  public pageData$ = this.pageDataSubject.asObservable();

  public selection = new SelectionModel<SchedulerEventWithCustomerInfo>(true, []);

  private allEntities: Observable<Array<SchedulerEventWithCustomerInfo>>;

  public dataLoading = true;

  public edgeId: string;

  constructor(private schedulerEventService: SchedulerEventService,
              private schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType},
              private route: ActivatedRoute) {
  }

  connect(collectionViewer: CollectionViewer):
    Observable<SchedulerEventWithCustomerInfo[] | ReadonlyArray<SchedulerEventWithCustomerInfo>> {
    return this.entitiesSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.entitiesSubject.complete();
    this.pageDataSubject.complete();
  }

  reset() {
    const pageData = emptyPageData<SchedulerEventWithCustomerInfo>();
    this.entitiesSubject.next(pageData.data);
    this.pageDataSubject.next(pageData);
  }

  loadEntities(pageLink: PageLink, eventType: string,
               reload: boolean = false): Observable<PageData<SchedulerEventWithCustomerInfo>> {
    this.dataLoading = true;
    if (reload) {
      this.allEntities = null;
    }
    const result = new ReplaySubject<PageData<SchedulerEventWithCustomerInfo>>();
    this.fetchEntities(eventType, pageLink).pipe(
      tap(() => {
        this.selection.clear();
      }),
      catchError(() => of([
        emptyPageData<SchedulerEventWithCustomerInfo>(),
        emptyPageData<SchedulerEventWithCustomerInfo>()
      ])),
    ).subscribe(
      (pageData) => {
        this.entitiesSubject.next(pageData[0].data);
        this.pageDataSubject.next(pageData[0]);
        result.next(pageData[1]);
        this.dataLoading = false;
      }
    );
    return result;
  }

  fetchEntities(eventType: string,
                pageLink: PageLink): Observable<Array<PageData<SchedulerEventWithCustomerInfo>>> {
    const allPageLinkData = new PageLink(Number.POSITIVE_INFINITY, 0, pageLink.textSearch);
    return this.getAllEntities(eventType).pipe(
      map((data) => allPageLinkData.filterData(data)),
      map((data) => [pageLink.filterData(data.data), data])
    );
  }

  getAllEntities(eventType: string): Observable<Array<SchedulerEventWithCustomerInfo>> {
    if (!this.allEntities) {
      let fetchObservable: Observable<Array<SchedulerEventWithCustomerInfo>>;
      if (this.edgeId) {
        fetchObservable = this.schedulerEventService.getEdgeSchedulerEvents(this.edgeId);
      } else {
        fetchObservable = this.schedulerEventService.getSchedulerEvents(eventType);
      }
      this.allEntities = fetchObservable.pipe(
        map((schedulerEvents) => {
          schedulerEvents.forEach((schedulerEvent) => {
            let typeName = schedulerEvent.type;
            if (this.schedulerEventConfigTypes[typeName]) {
              typeName = this.schedulerEventConfigTypes[typeName].name;
            }
            schedulerEvent.typeName = typeName;
          });
          return schedulerEvents;
        }),
        publishReplay(1),
        refCount()
      );
    }
    return this.allEntities;
  }

  isAllSelected(): Observable<boolean> {
    const numSelected = this.selection.selected.length;
    return this.entitiesSubject.pipe(
      map((entities) => numSelected === entities.length),
      share()
    );
  }

  isEmpty(): Observable<boolean> {
    return this.entitiesSubject.pipe(
      map((entities) => !entities.length),
      share()
    );
  }

  total(): Observable<number> {
    return this.pageDataSubject.pipe(
      map((pageData) => pageData.totalElements),
      share()
    );
  }

  masterToggle() {
    this.entitiesSubject.pipe(
      tap((entities) => {
        const numSelected = this.selection.selected.length;
        if (numSelected === entities.length) {
          this.selection.clear();
        } else {
          entities.forEach(row => {
            this.selection.select(row);
          });
        }
      }),
      take(1)
    ).subscribe();
  }
}

// /!*
//  * Copyright Â© 2020 ThingsBoard
//  *!/
// /!* eslint-disable import/no-unresolved, import/default *!/
//
// import schedulerEventsTemplate from './scheduler-events.tpl.html';
// import schedulerEventTemplate from './scheduler-event-dialog.tpl.html';
// // import schedulerEventsTitleTemplate from './scheduler-events-title.tpl.html';
//
// /!* eslint-enable import/no-unresolved, import/default *!/
//
// import SchedulerEventController from './scheduler-event-dialog.controller';
//
// /!*@ngInject*!/
// export default angular.module('eyeControl.schedulerEvents', [])
//   .directive('customSchedulerEvents', SchedulerEvents)
//   .name;
//
// function SchedulerEvents() {
//   return {
//     restrict: "E",
//     scope: true,
//     bindToController: {
//       widgetMode: '=',
//       ctx: '='
//     },
//     controller: SchedulerEventsController,
//     controllerAs: 'vm',
//     template: schedulerEventsTemplate
//   };
// }
//
// /!*@ngInject*!/
// function SchedulerEventsController($scope, $element, $compile, $q, $mdDialog, $mdUtil, $mdMedia, $document, $window, $translate, $filter, $timeout,
//                                    uiCalendarConfig, utils, types, securityTypes, userPermissionsService, userService, schedulerEventService) {
//
//   let vm = this;
//
//   vm.editEnabled = userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.write);
//   vm.addEnabled = userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.create);
//   vm.deleteEnabled = userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.delete);
//
//   vm.showData = (userService.getAuthority() === 'TENANT_ADMIN' || userService.getAuthority() === 'CUSTOMER_USER') &&
//     userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.read);
//
//   vm.mode = 'list';
//   vm.currentCalendarView = 'month';
//   vm.calendarId = 'eventScheduleCalendar-' + utils.guid();
//
//   vm.types = types;
//
//   vm.schedulerEvents = [];
//   vm.schedulerEventsCount = 0;
//   vm.allSchedulerEvents = [];
//   vm.selectedSchedulerEvents = [];
//
//   vm.displayCreatedTime = true;
//   vm.displayType = true;
//   vm.displayCustomer = true;//userService.getAuthority() === 'TENANT_ADMIN' ? true : false;
//
//   vm.displayPagination = true;
//   vm.defaultPageSize = 10;
//   vm.defaultSortOrder = 'createdTime';
//
//   vm.defaultEventType = null;
//   vm.devideId = null;
//
//   vm.query = {
//     order: vm.defaultSortOrder,
//     limit: vm.defaultPageSize,
//     page: 1,
//     search: null
//   };
//
//   vm.calendarConfig = {
//     height: 'parent',
//     editable: vm.editEnabled,
//     eventDurationEditable: false,
//     allDaySlot: false,
//     header: false,
//     timezone: 'UTC',
//     eventClick: onEventClick,
//     dayClick: (userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.create)) ? onDayClick : undefined,
//     eventDrop: onEventDrop,
//     eventRender: eventRender
//   };
//
//   vm.calendarEventSources = [ eventSourceFunction ];
//
//   vm.changeCalendarView = changeCalendarView;
//   vm.calendarViewTitle = calendarViewTitle;
//   vm.gotoCalendarToday = gotoCalendarToday;
//   vm.isCalendarToday = isCalendarToday;
//   vm.gotoCalendarPrev = gotoCalendarPrev;
//   vm.gotoCalendarNext = gotoCalendarNext;
//
//   vm.enterFilterMode = enterFilterMode;
//   vm.exitFilterMode = exitFilterMode;
//   vm.onReorder = onReorder;
//   vm.onPaginate = onPaginate;
//   vm.addSchedulerEvent = (userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.create)) ? addSchedulerEvent : undefined;
//   vm.editSchedulerEvent = editSchedulerEvent;
//   vm.viewSchedulerEvent = viewSchedulerEvent;
//   vm.deleteSchedulerEvent = deleteSchedulerEvent;
//   vm.deleteSchedulerEvents = deleteSchedulerEvents;
//   vm.reloadSchedulerEvents = reloadSchedulerEvents;
//   vm.updateSchedulerEvents = updateSchedulerEvents;
//   vm.loadEvents = loadEvents;
//
//   $scope.$watch("vm.query.search", function(newVal, prevVal) {
//     if (!angular.equals(newVal, prevVal) && vm.query.search != null) {
//       updateSchedulerEvents();
//     }
//   });
//
//   $scope.$watch("vm.mode", function(newVal, prevVal) {
//     if (!angular.equals(newVal, prevVal)) {
//       if (vm.mode == 'calendar') {
//         vm.selectedSchedulerEvents = [];
//       }
//       $mdUtil.nextTick(() => {
//         var w = angular.element($window);
//         w.triggerHandler('resize');
//       });
//     }
//   });
//
//   $scope.$watch(function() { return $mdMedia('gt-xs'); }, function(isGtXs) {
//     vm.isGtXs = isGtXs;
//   });
//
//   $scope.$watch(function() { return $mdMedia('gt-md'); }, function(isGtMd) {
//     vm.isGtMd = isGtMd;
//     if (vm.isGtMd) {
//       vm.limitOptions = [vm.defaultPageSize, vm.defaultPageSize * 2, vm.defaultPageSize * 3];
//     } else {
//       vm.limitOptions = null;
//     }
//   });
//
//   vm.configTypes = {};
//
//   if (vm.showData) {
//     if (vm.widgetMode) {
//       $scope.$watch('vm.ctx', function() {
//         if (vm.ctx) {
//           vm.settings = vm.ctx.settings;
//           initializeWidgetConfig();
//           reloadSchedulerEvents();
//         }
//       });
//     } else {
//       vm.configTypesList = types.schedulerEventConfigTypes;
//       vm.configTypesList.forEach((configType) => {
//         vm.configTypes[configType.value] = configType;
//       });
//       reloadSchedulerEvents();
//     }
//     $timeout(() => {
//       var w = angular.element($window);
//       w.triggerHandler('resize');
//     }, 100);
//   }
//
//   function initializeWidgetConfig() {
//     // vm.ctx.widgetConfig.showTitle = true;
//     vm.ctx.currentSchedulerMode = 'list';
//     vm.ctx.widgetTitle = vm.ctx.settings.title;
//
//     vm.displayCreatedTime = angular.isDefined(vm.settings.displayCreatedTime) ? vm.settings.displayCreatedTime : true;
//     vm.displayType = angular.isDefined(vm.settings.displayType) ? vm.settings.displayType : true;
//     vm.displayCustomer = angular.isDefined(vm.settings.displayCustomer) ? vm.settings.displayCustomer : true;
//
//     vm.displayPagination = angular.isDefined(vm.settings.displayPagination) ? vm.settings.displayPagination : true;
//
//     var pageSize = vm.settings.defaultPageSize;
//     if (angular.isDefined(pageSize) && angular.isNumber(pageSize) && pageSize > 0) {
//       vm.defaultPageSize = pageSize;
//     }
//
//     if (vm.settings.defaultSortOrder && vm.settings.defaultSortOrder.length) {
//       vm.defaultSortOrder = vm.settings.defaultSortOrder;
//     }
//
//     if (vm.settings.forceDefaultEventType && vm.settings.forceDefaultEventType.length) {
//       vm.defaultEventType = vm.settings.forceDefaultEventType;
//     }
//     var widgetConfigTypes;
//     if (vm.settings.customEventTypes && vm.settings.customEventTypes.length) {
//       widgetConfigTypes = vm.settings.customEventTypes;
//     } else {
//       widgetConfigTypes = [];
//     }
//     vm.configTypesList = widgetConfigTypes ? widgetConfigTypes : types.schedulerEventConfigTypes.concat(widgetConfigTypes);
//     vm.configTypesList.forEach((configType) => {
//       vm.configTypes[configType.value] = configType;
//     });
//
//     vm.query.order = vm.defaultSortOrder;
//     vm.query.limit = vm.defaultPageSize;
//     if (vm.isGtMd) {
//       vm.limitOptions = [vm.defaultPageSize, vm.defaultPageSize * 2, vm.defaultPageSize * 3];
//     } else {
//       vm.limitOptions = null;
//     }
//
//     if (vm.settings.enabledViews != 'both') {
//       vm.ctx.currentSchedulerMode = vm.settings.enabledViews;
//       vm.mode = vm.settings.enabledViews;
//     }
//
//     $scope.$watch('vm.ctx.currentSchedulerMode', function() {
//       vm.mode = vm.ctx.currentSchedulerMode;
//     });
//     $scope.$watch('vm.selectedSchedulerEvents.length', function(newVal) {
//       if (newVal) {
//         vm.ctx.hideTitlePanel = true;
//       } else {
//         vm.ctx.hideTitlePanel = false;
//       }
//     });
//     $scope.$on('scheduler-events-resize', function() {
//       if (vm.mode === 'calendar') {
//         var w = angular.element($window);
//         w.triggerHandler('resize');
//       }
//     });
//     vm.ctx.widgetActions = [
//       {
//         name: 'scheduler.add-scheduler-event',
//         show: (userPermissionsService.hasGenericPermission(securityTypes.resource.schedulerEvent, securityTypes.operation.create)),
//         onAction: function(event) {
//           vm.addSchedulerEvent(event);
//         },
//         icon: 'add'
//       },
//       {
//         name: 'action.search',
//         show: true,
//         onAction: function(event) {
//           vm.enterFilterMode(event);
//         },
//         icon: 'search'
//       },
//       {
//         name: 'action.refresh',
//         show: true,
//         onAction: function() {
//           vm.reloadSchedulerEvents();
//         },
//         icon: 'refresh'
//       }
//     ];
//   }
//
//   function onEventClick(event, $event) {
//     var result = $filter('filter')(vm.schedulerEvents, {id: {id: event.id}}, true);
//     if (result && result.length) {
//       var parent = angular.element('#tb-event-schedule-calendar-context-menu', $element);
//       var $mdOpenMousepointMenu = parent.scope().$mdOpenMousepointMenu;
//       openSchedulerEventContextMenu($event, result[0], $mdOpenMousepointMenu);
//     }
//   }
//
//   function openSchedulerEventContextMenu($event, schedulerEvent, $mdOpenMousepointMenu) {
//     vm.contextMenuEvent = $event;
//     vm.contextMenuSchedulerEvent = schedulerEvent;
//     $mdOpenMousepointMenu($event);
//   }
//
//   function onDayClick(date, $event/!*, view*!/) {
//     if (vm.addEnabled) {
//       var schedulerEvent = {
//         schedule: {
//           startTime: date.utc().valueOf()
//         },
//         configuration: {}
//       };
//       openSchedulerEventDialog($event, schedulerEvent);
//     }
//   }
//
//   function onEventDrop(event, delta, revertFunc/!*, $event*!/) {
//     var result = $filter('filter')(vm.schedulerEvents, {id: {id: event.id}}, true);
//     if (result && result.length) {
//       var origEvent = result[0];
//       moveEvent(origEvent, delta, revertFunc);
//     }
//   }
//
//   function moveEvent(schedulerEvent, delta, revertFunc) {
//     schedulerEventService.getSchedulerEvent(schedulerEvent.id.id).then(
//       (schedulerEvent) => {
//         schedulerEvent.schedule.startTime += delta.asMilliseconds();
//         schedulerEventService.saveSchedulerEvent(schedulerEvent).then(
//           () => {
//             reloadSchedulerEvents();
//           },
//           () => {
//             revertFunc();
//           }
//         );
//       },
//       () => {
//         revertFunc();
//       }
//     );
//   }
//
//   function eventRender(event, element/!*, view*!/) {
//     if (event.htmlTitle) {
//       if(element.find('.fc-title').length > 0) {
//         element.find('.fc-title')[0].innerHTML = event.htmlTitle;
//       }
//       if(element.find('.fc-list-item-title').length > 0) {
//         element.find('.fc-list-item-title')[0].innerHTML = event.htmlTitle;
//       }
//     }
//     element.tooltipster(
//       {
//         theme: 'tooltipster-shadow',
//         delay: 100,
//         trigger: 'hover',
//         triggerOpen: {
//           click: false,
//           tap: false
//         },
//         triggerClose: {
//           click: true,
//           tap: true,
//           scroll: true
//         },
//         side: 'top',
//         trackOrigin: true
//       }
//     );
//     var tooltip = element.tooltipster('instance');
//     tooltip.content(angular.element(
//       '<div class="tb-scheduler-tooltip-content"><b>' + $translate.instant('scheduler.event-type') + ':</b> ' + event.type + '</div>' +
//       '<div class="tb-scheduler-tooltip-content">' + event.info + '</div>'
//     ));
//
//   }
//
//   var schedulerTimeUnitRepeatTranslation = {
//     'HOURS': 'scheduler.every-hour',
//     'MINUTES': 'scheduler.every-minute',
//     'SECONDS': 'scheduler.every-second'
//   };
//
//   function eventSourceFunction(start, end, timezone, callback) {
//     var events = [];
//     if (vm.schedulerEvents && vm.schedulerEvents.length) {
//       var userZone = moment.tz.zone(moment.tz.guess()); //eslint-disable-line
//       var rangeStart = start.local();
//       var rangeEnd = end.local();
//       vm.schedulerEvents.forEach((event) => {
//         var startOffset = userZone.utcOffset(event.schedule.startTime) * 60 * 1000;
//         var eventStart = moment(event.schedule.startTime - startOffset); //eslint-disable-line
//         var calendarEvent;
//         if (rangeEnd.isSameOrAfter(eventStart)) {
//           if (event.schedule.repeat) {
//             var endOffset = userZone.utcOffset(event.schedule.repeat.endsOn) * 60 * 1000;
//             var repeatEndsOn = moment(event.schedule.repeat.endsOn - endOffset); //eslint-disable-line
//             if (event.schedule.repeat.type === types.schedulerRepeat.timer.value) {
//               calendarEvent = toCalendarEvent(event, eventStart, repeatEndsOn);
//               events.push(calendarEvent);
//             } else {
//               var currentTime;
//               var eventStartOffsetUnits = 0;
//               if (rangeStart.isSameOrBefore(eventStart)) {
//                 currentTime = eventStart.clone();
//               } else {
//                 switch (event.schedule.repeat.type) {
//                   case types.schedulerRepeat.yearly.value:
//                   case types.schedulerRepeat.monthly.value:
//                     eventStartOffsetUnits = moment.duration(rangeStart.diff(eventStart));//eslint-disable-line
//                     eventStartOffsetUnits = Math.ceil(eventStartOffsetUnits.as(types.schedulerRepeat[event.schedule.repeat.type.toLowerCase()].type));
//                     currentTime = eventStart.clone().add(eventStartOffsetUnits, types.schedulerRepeat[event.schedule.repeat.type.toLowerCase()].type);
//                     break;
//                   default:
//                     currentTime = rangeStart.clone();
//                     currentTime.hours(eventStart.hours());
//                     currentTime.minutes(eventStart.minutes());
//                     currentTime.seconds(eventStart.seconds());
//                 }
//               }
//               var endDate;
//               if (rangeEnd.isSameOrAfter(repeatEndsOn)) {
//                 endDate = repeatEndsOn.clone();
//               } else {
//                 endDate = rangeEnd.clone();
//               }
//               while (currentTime.isBefore(endDate)) {
//                 var day = currentTime.day();
//                 if (event.schedule.repeat.type !== types.schedulerRepeat.weekly.value ||
//                   event.schedule.repeat.repeatOn.indexOf(day) !== -1) {
//                   var currentEventStart = currentTime.clone();
//                   calendarEvent = toCalendarEvent(event, currentEventStart, currentEventStart);
//                   events.push(calendarEvent);
//                 }
//                 switch (event.schedule.repeat.type) {
//                   case types.schedulerRepeat.yearly.value:
//                   case types.schedulerRepeat.monthly.value:
//                     eventStartOffsetUnits++;
//                     currentTime = eventStart.clone().add(eventStartOffsetUnits, types.schedulerRepeat[event.schedule.repeat.type.toLowerCase()].type);
//                     break;
//                   default:
//                     currentTime.add(1, 'days');
//                 }
//               }
//             }
//           } else if (rangeStart.isSameOrBefore(eventStart)) {
//             calendarEvent = toCalendarEvent(event, eventStart, eventStart);
//             events.push(calendarEvent);
//           }
//         }
//
//       });
//     }
//     callback(events);
//   }
//
//   function toCalendarEvent(event, start, end) {
//     var title = event.name + ' - ' + event.typeName;
//     var htmlTitle = null;
//     if (event.schedule.repeat && event.schedule.repeat.type === types.schedulerRepeat.timer.value) {
//       var repeatInterval = $translate.instant(schedulerTimeUnitRepeatTranslation[event.schedule.repeat.timeUnit],
//         {count: event.schedule.repeat.repeatInterval}, 'messageformat');
//       htmlTitle = ` <b>${repeatInterval}</b> ${title}`;
//     }
//     var calendarEvent = {
//       id: event.id.id,
//       title: title,
//       name: event.name,
//       type: event.typeName,
//       info: eventInfo(event),
//       start: start,
//       end: end ? end.toDate() : null,
//       htmlTitle: htmlTitle
//     };
//     return calendarEvent;
//   }
//
//   function eventInfo(event) {
//     var info = '';
//     var startTime = event.schedule.startTime;
//     if (!event.schedule.repeat) {
//       var start;
//       start = moment.utc(startTime).local().format('MMM DD, YYYY, hh:mma'); //eslint-disable-line
//       info += start;
//       return info;
//     } else {
//       info += moment.utc(startTime).local().format('hh:mma'); //eslint-disable-line
//       info += '<br/>';
//       info += $translate.instant('scheduler.starting-from') + ' ' + moment.utc(startTime).local().format('MMM DD, YYYY') + ', '; //eslint-disable-line
//       if (event.schedule.repeat.type == types.schedulerRepeat.daily.value) {
//         info += $translate.instant('scheduler.daily') + ', ';
//       } else if (event.schedule.repeat.type == types.schedulerRepeat.monthly.value) {
//         info += $translate.instant('scheduler.monthly') + ', ';
//       } else if (event.schedule.repeat.type == types.schedulerRepeat.yearly.value) {
//         info += $translate.instant('scheduler.yearly') + ', ';
//       } else if (event.schedule.repeat.type == types.schedulerRepeat.timer.value) {
//         var repeatInterval = $translate.instant(schedulerTimeUnitRepeatTranslation[event.schedule.repeat.timeUnit],
//           {count: event.schedule.repeat.repeatInterval}, 'messageformat');
//         info += repeatInterval + ', ';
//       } else {
//         info += $translate.instant('scheduler.weekly') + ' ' + $translate.instant('scheduler.on') + ' ';
//         for (var i = 0; i < event.schedule.repeat.repeatOn.length; i++) {
//           var day = event.schedule.repeat.repeatOn[i];
//           info += $translate.instant(types.schedulerWeekday[day]) + ', ';
//         }
//       }
//       info += $translate.instant('scheduler.until') + ' ';
//       var endsOn = moment.utc(event.schedule.repeat.endsOn).local().format('MMM DD, YYYY');  //eslint-disable-line
//       info += endsOn;
//       return info;
//     }
//   }
//
//   function loadEvents(){
//     reloadSchedulerEvents();
//   }
//
//   function changeCalendarView() {
//     calendarElem().fullCalendar('changeView', vm.currentCalendarView);
//   }
//
//   function calendarViewTitle() {
//     var cElem = calendarElem();
//     if (cElem) {
//       return cElem.fullCalendar('getView').title;
//     } else {
//       return '';
//     }
//   }
//
//   function gotoCalendarToday() {
//     calendarElem().fullCalendar('today');
//   }
//
//   function isCalendarToday() {
//     var cElem = calendarElem();
//     if (cElem) {
//       var calendar = cElem.fullCalendar('getCalendar');
//       if (!calendar) {
//         return false;
//       }
//       var now = calendar.getNow();
//       var view = cElem.fullCalendar('getView');
//       return view.dateProfile.currentUnzonedRange.containsDate(now);
//     } else {
//       return false;
//     }
//   }
//
//   function gotoCalendarPrev() {
//     calendarElem().fullCalendar('prev');
//   }
//
//   function gotoCalendarNext() {
//     calendarElem().fullCalendar('next');
//   }
//
//   function calendarElem() {
//     var element = uiCalendarConfig.calendars[vm.calendarId];
//     if (element && element.data('fullCalendar')) {
//       return element;
//     } else {
//       return null;
//     }
//   }
//
//   function enterFilterMode(event) {
//     vm.query.search = '';
//     if (vm.widgetMode) {
//       vm.ctx.hideTitlePanel = true;
//     }
//
//     $timeout(() => {
//       if (vm.widgetMode) {
//         angular.element(vm.ctx.$container).find('.searchInput').focus();
//       } else {
//         let $button = angular.element(event.currentTarget);
//         let $toolbarsContainer = $button.closest('.toolbarsContainer');
//         $toolbarsContainer.find('.searchInput').focus();
//       }
//     })
//   }
//
//   function exitFilterMode() {
//     vm.query.search = null;
//     updateSchedulerEvents();
//     if (vm.widgetMode) {
//       vm.ctx.hideTitlePanel = false;
//     }
//   }
//
//   function onReorder() {
//     updateSchedulerEvents();
//   }
//
//   function onPaginate() {
//     updateSchedulerEvents();
//   }
//
//   function addSchedulerEvent($event) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     openSchedulerEventDialog($event);
//   }
//
//   function editSchedulerEvent($event, schedulerEvent) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     schedulerEventService.getSchedulerEvent(schedulerEvent.id.id).then(
//       (schedulerEvent) => {
//         openSchedulerEventDialog($event, schedulerEvent);
//       }
//     );
//   }
//
//   function viewSchedulerEvent($event, schedulerEvent) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     schedulerEventService.getSchedulerEvent(schedulerEvent.id.id).then(
//       (schedulerEvent) => {
//         openSchedulerEventDialog($event, schedulerEvent, true);
//       }
//     );
//   }
//
//   function openSchedulerEventDialog($event, schedulerEvent, readonly) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     var isAdd = false;
//     if (!schedulerEvent || !schedulerEvent.id) {
//       isAdd = true;
//       if (!schedulerEvent) {
//         schedulerEvent = {
//           schedule: {},
//           configuration: {
//             originatorId: null,
//             msgType: null,
//             msgBody: {},
//             metadata: {}
//           }
//         };
//       }
//     }
//     $mdDialog.show({
//       controller: SchedulerEventController,
//       controllerAs: 'vm',
//       template: schedulerEventTemplate,
//       parent: angular.element($document[0].body),
//       locals: {
//         configTypesList: vm.configTypesList,
//         isAdd: isAdd,
//         readonly: readonly,
//         schedulerEvent: schedulerEvent,
//         defaultEventType: vm.defaultEventType,
//         ctx: vm.ctx
//       },
//       targetEvent: $event,
//       fullscreen: true,
//       multiple: true,
//       onComplete: function () {
//         var w = angular.element($window);
//         w.triggerHandler('resize');
//       }
//     }).then(function () {
//       reloadSchedulerEvents();
//     }, function () {
//     });
//   }
//
//   function deleteSchedulerEvent($event, schedulerEvent) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     if (schedulerEvent) {
//       var title = $translate.instant('scheduler.delete-scheduler-event-title', {schedulerEventName: schedulerEvent.name});
//       var content = $translate.instant('scheduler.delete-scheduler-event-text');
//
//       var confirm = $mdDialog.confirm()
//         .targetEvent($event)
//         .title(title)
//         .htmlContent(content)
//         .ariaLabel(title)
//         .cancel($translate.instant('action.no'))
//         .ok($translate.instant('action.yes'));
//       $mdDialog.show(confirm).then(function() {
//         schedulerEventService.deleteSchedulerEvent(schedulerEvent.id.id).then(
//           () => {
//             reloadSchedulerEvents();
//           }
//         );
//       });
//     }
//   }
//
//   function deleteSchedulerEvents($event) {
//     if ($event) {
//       $event.stopPropagation();
//     }
//     if (vm.selectedSchedulerEvents && vm.selectedSchedulerEvents.length > 0) {
//       var title = $translate.instant('scheduler.delete-scheduler-events-title', {count: vm.selectedSchedulerEvents.length}, 'messageformat');
//       var content = $translate.instant('scheduler.delete-scheduler-events-text');
//       var confirm = $mdDialog.confirm()
//         .targetEvent($event)
//         .title(title)
//         .htmlContent(content)
//         .ariaLabel(title)
//         .cancel($translate.instant('action.no'))
//         .ok($translate.instant('action.yes'));
//       $mdDialog.show(confirm).then(function() {
//         var tasks = [];
//         for (var i = 0; i < vm.selectedSchedulerEvents.length; i++) {
//           var schedulerEvent = vm.selectedSchedulerEvents[i];
//           tasks.push(schedulerEventService.deleteSchedulerEvent(schedulerEvent.id.id));
//         }
//         $q.all(tasks).then(
//           () => {
//             reloadSchedulerEvents();
//           }
//         );
//
//       });
//     }
//   }
//
//   function reloadSchedulerEvents() {
//     vm.allSchedulerEvents.length = 0;
//     vm.schedulerEvents.length = 0;
//     vm.schedulerEventsPromise;
//     vm.schedulerEventsPromise = schedulerEventService.getSchedulerEvents(vm.defaultEventType, vm.displayCustomer);
//     vm.schedulerEventsPromise.then(
//       function success(allSchedulerEvents) {
//         const tasks  = [];
//         allSchedulerEvents.forEach(
//           (schedulerEvent) => {
//             var typeName = schedulerEvent.type;
//             if (vm.configTypes[typeName]) {
//               typeName = vm.configTypes[typeName].name;
//             }
//             schedulerEvent.typeName = typeName;
//           }
//         );
//         const user = userService.getCurrentUser();
//         vm.allSchedulerEvents = allSchedulerEvents.filter(event=>{
//           return user.customerId === event.customerId.id
//         });
//         vm.allSchedulerEvents.forEach(
//           (schedulerEvent) => {
//             tasks.push(schedulerEventService.getSchedulerEvent(schedulerEvent.id.id))
//           }
//         );
//         $q.all(tasks).then(
//           function success(allSchedulerEvents) {
//             allSchedulerEvents.forEach(
//               (schedulerEvent) => {
//                 var typeName = schedulerEvent.type;
//                 if (vm.configTypes[typeName]) {
//                   typeName = vm.configTypes[typeName].name;
//                 }
//                 schedulerEvent.typeName = typeName;
//               }
//             );
//             vm.allSchedulerEvents = allSchedulerEvents.filter(event => {
//               return vm.ctx.datasources[0].entityId === event.configuration.metadata.deviceId
//             });
//             vm.selectedSchedulerEvents = [];
//             vm.updateSchedulerEvents();
//             vm.schedulerEventsPromise = null;
//           },
//           function fail() {
//             vm.allSchedulerEvents = [];
//             vm.selectedSchedulerEvents = [];
//             vm.updateSchedulerEvents();
//             vm.schedulerEventsPromise = null;
//           }
//         )
//       },
//       function fail() {
//         vm.allSchedulerEvents = [];
//         vm.selectedSchedulerEvents = [];
//         vm.updateSchedulerEvents();
//         vm.schedulerEventsPromise = null;
//       }
//     )
//   }
//
//   function updateSchedulerEvents() {
//     vm.selectedSchedulerEvents = [];
//     var result = $filter('orderBy')(vm.allSchedulerEvents, vm.query.order);
//     if (vm.query.search != null) {
//       result = $filter('filter')(result, {$: vm.query.search});
//     }
//     vm.schedulerEventsCount = result.length;
//     var startIndex = vm.query.limit * (vm.query.page - 1);
//     vm.schedulerEvents = result.slice(startIndex, startIndex + vm.query.limit);
//     calendarElem().fullCalendar('refetchEvents');
//   }
//
// }
