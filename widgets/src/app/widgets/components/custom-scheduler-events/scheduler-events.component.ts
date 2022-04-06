import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {
  AuthUser,
  Direction,
  emptyPageData,
  getUserZone,
  hidePageSizePixelValue,
  PageComponent,
  PageData,
  PageLink,
  PageQueryParam,
  SortOrder,
  sortOrderFromString
} from '@shared/public-api';
import { Store } from '@ngrx/store';
import {
  AppState,
  deepClone,
  DialogService,
  isDefined,
  isEmptyStr,
  isNotEmptyStr,
  isNumber,
  SchedulerEventService,
  UserPermissionsService,
  UserService,
  UtilsService
} from '@core/public-api';
import { WidgetContext } from '../../models/widget-component.models';
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
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, SortDirection } from '@angular/material/sort';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { SchedulerEventDialogComponent } from './scheduler-event-dialog.component';
import { SchedulerEventDialogData } from './scheduler-event-dialog.component';
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
import { ActivatedRoute, QueryParamsHandling, Router } from '@angular/router';
import { ResizeObserver } from '@juggle/resize-observer';
import { defaultSchedulerEventConfigTypes, SchedulerEventConfigType } from './scheduler-event-config.models';
import { getCurrentAuthUser } from '../../models/auth.selectors';

enum Resource {
  CUSTOMER = "CUSTOMER",
  SCHEDULER_EVENT = "SCHEDULER_EVENT"
}
enum Operation {
  CREATE = "CREATE",
  READ = "READ",
  WRITE = "WRITE",
  DELETE = "DELETE"
}

@Component({
  selector: 'custom-scheduler-events',
  templateUrl: './scheduler-events.component.html',
  styleUrls: ['./scheduler-events.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SchedulerEventsComponent extends PageComponent implements OnInit, AfterViewInit {

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

  currentUserAuthority = getCurrentAuthUser(this.store).authority;
  showData = (this.currentUserAuthority === 'TENANT_ADMIN' || this.currentUserAuthority === 'CUSTOMER_USER') &&
    this.userPermissionsService.hasGenericPermission(Resource.SCHEDULER_EVENT, Operation.READ);

  mode = 'list';
  isListMode = () => this.mode === 'list';
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

  eventSources: EventSourceInput[] = [this.eventSourceFunction.bind(this)];

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
              private userService: UserService,
              private dialogService: DialogService,
              private dialog: MatDialog,
              private router: Router,
              private route: ActivatedRoute,
              private cd: ChangeDetectorRef) {
    super(store);
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

  ngAfterViewInit() {
    if (this.showData) {
      setTimeout(() => {
        this.calendarApi = this.calendarComponent.getApi();
        this.calendarApi.refetchEvents();
        if (this.widgetMode && this.mode === 'calendar') {
          this.resize();
        }
      }, 0);

      fromEvent(this.searchInputField.nativeElement, 'keyup')
        .pipe(
          debounceTime(150),
          distinctUntilChanged(),
          tap(() => {
            if (this.displayPagination) {
              this.paginator.pageIndex = 0;
            }
            if (this.widgetMode) {
              this.updateData();
            } else {
              const queryParams: PageQueryParam = {
                textSearch: encodeURI(this.pageLink.textSearch) || null,
                page: null
              };
              this.updatedRouterQueryParams(queryParams);
            }
          })
        )
        .subscribe();

      let paginatorSubscription$: Observable<object>;
      const sortSubscription$: Observable<object> = this.sort.sortChange.asObservable().pipe(
        map((data) => {
          const direction = data.direction.toUpperCase();
          const queryParams: PageQueryParam = {
            direction: Direction.ASC === direction ? null : direction as Direction,
            property: this.defaultSortOrder === data.active ? null : data.active,
            page: null
          };
          if (this.displayPagination) {
            this.paginator.pageIndex = 0;
          }
          return queryParams;
        })
      );

      if (this.displayPagination) {
        if (this.displayPagination) {
          paginatorSubscription$ = this.paginator.page.asObservable().pipe(
            map((data) => {
              return {
                page: data.pageIndex === 0 ? null : data.pageIndex,
                pageSize: data.pageSize === this.defaultPageSize ? null : data.pageSize
              };
            })
          );
        }
      }

      ((this.displayPagination ? merge(sortSubscription$, paginatorSubscription$) : sortSubscription$) as Observable<PageQueryParam>)
        .pipe(
          tap((queryParams) => {
            if (this.widgetMode) {
              this.updateData();
            } else {
              this.updatedRouterQueryParams(queryParams);
            }
          })
        )
        .subscribe();

      if (!this.widgetMode) {
        this.route.queryParams.pipe(skip(1)).subscribe((params: PageQueryParam) => {
          this.paginator.pageIndex = Number(params.page) || 0;
          this.paginator.pageSize = Number(params.pageSize) || this.defaultPageSize;
          this.sort.active = params.property || this.defaultSortOrder;
          this.sort.direction = (params.direction || Direction.ASC).toLowerCase() as SortDirection;
          if (params.hasOwnProperty('textSearch') && !isEmptyStr(params.textSearch)) {
            this.textSearchMode = true;
            this.pageLink.textSearch = decodeURI(params.textSearch);
          } else {
            this.textSearchMode = false;
            this.pageLink.textSearch = null;
          }
          this.updateData();
        });
      }

      this.updateData(true);
    }
  }

  ngOnDestroy(): void {
    if (this.widgetResize$) {
      this.widgetResize$.disconnect();
    }
  }

  resize() {
    if (this.mode === 'calendar' && this.calendarApi) {
      this.calendarApi.updateSize();
    }
  }

  updateData(reload: boolean = false) {
    if (this.displayPagination) {
      this.pageLink.page = this.paginator.pageIndex;
      this.pageLink.pageSize = this.paginator.pageSize;
    } else {
      this.pageLink.page = 0;
    }
    this.pageLink.sortOrder.property = this.sort.active;
    this.pageLink.sortOrder.direction = Direction[this.sort.direction.toUpperCase()];
    this.dataSource.loadEntities(this.pageLink, this.defaultEventType, reload).subscribe(
      (data) => {
        this.updateCalendarEvents(data.data);
      }
    );
    if (this.widgetMode) {
      this.ctx.detectChanges();
    }
  }

  private initializeWidgetConfig() {
    // this.ctx.widgetConfig.showTitle = false;
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
          this.addSchedulerEvent($event);
        }
      },
      {
        name: 'action.search',
        show: true,
        icon: 'search',
        onAction: () => {
          this.enterFilterMode();
        }
      },
      {
        name: 'action.refresh',
        show: true,
        icon: 'refresh',
        onAction: () => {
          this.reloadSchedulerEvents();
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

  enterFilterMode() {
    this.textSearchMode = true;
    this.pageLink.textSearch = '';
    if (this.widgetMode) {
      this.ctx.hideTitlePanel = true;
      this.ctx.detectChanges(true);
    }
    setTimeout(() => {
      this.searchInputField.nativeElement.focus();
      this.searchInputField.nativeElement.setSelectionRange(0, 0);
    }, 10);
  }

  exitFilterMode() {
    this.textSearchMode = false;
    this.pageLink.textSearch = null;
    if (this.displayPagination) {
      this.paginator.pageIndex = 0;
    }
    if (this.widgetMode) {
      this.updateData();
      this.ctx.hideTitlePanel = false;
      this.ctx.detectChanges(true);
    } else {
      const queryParams: PageQueryParam = {
        textSearch: null,
        page: null
      };
      this.updatedRouterQueryParams(queryParams);
    }
  }

  reloadSchedulerEvents() {
    this.updateData(true);
  }

  deleteSchedulerEvent($event: Event, schedulerEvent: SchedulerEventWithCustomerInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    const title = this.translate.instant('scheduler.delete-scheduler-event-title', {schedulerEventName: schedulerEvent.name});
    const content = this.translate.instant('scheduler.delete-scheduler-event-text');
    this.dialogService.confirm(title, content,
      this.translate.instant('action.no'),
      this.translate.instant('action.yes')).subscribe((result) => {
      if (result) {
        this.schedulerEventService.deleteSchedulerEvent(schedulerEvent.id.id).subscribe(
          () => {
            this.reloadSchedulerEvents();
          }
        );
      }
    });
  }

  deleteSchedulerEvents($event: Event) {
    if ($event) {
      $event.stopPropagation();
    }
    const selectedSchedulerEvents = this.dataSource.selection.selected;
    if (selectedSchedulerEvents && selectedSchedulerEvents.length) {
      const title = this.translate.instant('scheduler.delete-scheduler-events-title', {count: selectedSchedulerEvents.length});
      const content = this.translate.instant('scheduler.delete-scheduler-events-text');
      this.dialogService.confirm(title, content,
        this.translate.instant('action.no'),
        this.translate.instant('action.yes')).subscribe((result) => {
        if (result) {
          const tasks = selectedSchedulerEvents.map((schedulerEvent) =>
            this.schedulerEventService.deleteSchedulerEvent(schedulerEvent.id.id));
          forkJoin(tasks).subscribe(
            () => {
              this.reloadSchedulerEvents();
            }
          );
        }
      });
    }
  }

  addSchedulerEvent($event: Event) {
    this.openSchedulerEventDialog($event);
  }

  editSchedulerEvent($event, schedulerEventWithCustomerInfo: SchedulerEventWithCustomerInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    this.schedulerEventService.getSchedulerEvent(schedulerEventWithCustomerInfo.id.id)
      .subscribe((schedulerEvent) => {
        this.openSchedulerEventDialog($event, schedulerEvent);
      });
  }

  viewSchedulerEvent($event, schedulerEventWithCustomerInfo: SchedulerEventWithCustomerInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    this.schedulerEventService.getSchedulerEvent(schedulerEventWithCustomerInfo.id.id)
      .subscribe((schedulerEvent) => {
        this.openSchedulerEventDialog($event, schedulerEvent, true);
      });
  }

  openSchedulerEventDialog($event: Event, schedulerEvent?: SchedulerEvent, readonly = false) {
    if ($event) {
      $event.stopPropagation();
    }
    let isAdd = false;
    if (!schedulerEvent || !schedulerEvent.id) {
      isAdd = true;
      if (!schedulerEvent) {
        schedulerEvent = {
          name: null,
          type: null,
          schedule: null,
          configuration: {
            originatorId: null,
            msgType: null,
            msgBody: {},
            metadata: {}
          }
        };
      }
    }
    this.dialog.open<SchedulerEventDialogComponent, SchedulerEventDialogData, boolean>(SchedulerEventDialogComponent, {
      disableClose: true,
      panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
      data: {
        schedulerEventConfigTypes: this.schedulerEventConfigTypes,
        isAdd,
        readonly,
        schedulerEvent,
        defaultEventType: this.defaultEventType,
        ctx: this.ctx
      }
    }).afterClosed().subscribe(
      (res) => {
        if (res) {
          this.reloadSchedulerEvents();
        }
      }
    );
  }

  triggerResize() {
    setTimeout(() => {
      this.calendarComponent.getApi().updateSize();
    }, 0);
  }

  changeCalendarView() {
    this.currentCalendarViewValue = schedulerCalendarViewValueMap.get(this.currentCalendarView);
    this.calendarApi.changeView(this.currentCalendarViewValue);
  }

  calendarViewTitle(): string {
    if (this.calendarApi) {
      return this.calendarApi.view.title;
    } else {
      return '';
    }
  }

  gotoCalendarToday() {
    this.calendarApi.today();
  }

  isCalendarToday(): boolean {
    if (this.calendarApi) {
      const now = this.calendarApi.getNow();
      const view = this.calendarApi.view;
      return rangeContainsMarker(view.props.dateProfile.currentRange, now);
    } else {
      return false;
    }
  }

  gotoCalendarPrev() {
    this.calendarApi.prev();
  }

  gotoCalendarNext() {
    this.calendarApi.next();
  }

  onEventClick(arg: EventHandlerArg<'eventClick'>) {
    const schedulerEvent = this.schedulerEvents.find(event => event.id.id === arg.event.id);
    if (schedulerEvent) {
      this.openSchedulerEventContextMenu(arg.jsEvent, schedulerEvent);
    }
  }

  openSchedulerEventContextMenu($event: MouseEvent, schedulerEvent: SchedulerEventWithCustomerInfo) {
    $event.preventDefault();
    $event.stopPropagation();
    const $element = $(this.calendarContainer.nativeElement);
    const offset = $element.offset();
    const x = $event.pageX - offset.left;
    const y = $event.pageY - offset.top;
    this.schedulerContextMenuEvent = $event;
    this.schedulerEventMenuPosition.x = x + 'px';
    this.schedulerEventMenuPosition.y = y + 'px';
    this.schedulerEventMenuTrigger.menuData = { schedulerEvent };
    this.schedulerEventMenuTrigger.openMenu();
  }

  onSchedulerEventContextMenuMouseLeave() {
    this.schedulerEventMenuTrigger.closeMenu();
  }

  onDayClick(event: DateClickApi) {
    if (this.addEnabled) {
      const calendarDate = new Date(event.date.getTime() + event.date.getTimezoneOffset() * 60 * 1000);
      const date = toMoment(calendarDate, this.calendarApi);
      const schedulerEvent = {
        schedule: {
          startTime: date.utc().valueOf()
        },
        configuration: {
          originatorId: null,
          msgType: null,
          msgBody: {},
          metadata: {}
        }
      } as SchedulerEvent;
      this.openSchedulerEventDialog(event.jsEvent, schedulerEvent);
    }
  }

  onEventDrop(arg: EventHandlerArg<'eventDrop'>) {
    const schedulerEvent = this.schedulerEvents.find(event => event.id.id === arg.event.id);
    if (schedulerEvent) {
      this.moveEvent(schedulerEvent, arg.delta, arg.revert);
    }
  }

  private moveEvent(event: SchedulerEventWithCustomerInfo, delta: Duration, revertFunc: () => void) {
    this.schedulerEventService.getSchedulerEvent(event.id.id).subscribe(
      (schedulerEvent) => {
        schedulerEvent.schedule.startTime += asRoughMs(delta);
        this.schedulerEventService.saveSchedulerEvent(schedulerEvent).subscribe(
          () => {
            this.reloadSchedulerEvents();
          },
          () => {
            revertFunc();
          }
        );
      },
      () => {
        revertFunc();
      }
    );
  }

  eventRender(arg: EventHandlerArg<'eventRender'>) {
    const props: {name: string, type: string, info: string, htmlTitle: string} = arg.event.extendedProps;
    if (props.htmlTitle) {
      if (arg.el.getElementsByClassName('fc-title').length > 0) {
        arg.el.getElementsByClassName('fc-title')[0].innerHTML = props.htmlTitle;
      }
      if (arg.el.getElementsByClassName('fc-list-item-title').length > 0) {
        arg.el.getElementsByClassName('fc-list-item-title')[0].innerHTML = props.htmlTitle;
      }
    }
    const element = $(arg.el);
    /*import('tooltipster').then(
      () => {
        element.tooltipster(
          {
            theme: 'tooltipster-shadow',
            delay: 100,
            trigger: 'hover',
            triggerOpen: {
              click: false,
              tap: false
            },
            triggerClose: {
              click: true,
              tap: true,
              scroll: true
            },
            side: 'top',
            trackOrigin: true
          }
        );
        const tooltip = element.tooltipster('instance');
        tooltip.content($(
          '<div class="tb-scheduler-tooltip-title">' + props.name + '</div>' +
          '<div class="tb-scheduler-tooltip-content"><b>' + this.translate.instant('scheduler.event-type') + ':</b> ' + props.type + '</div>' +
          '<div class="tb-scheduler-tooltip-content">' + props.info + '</div>'
        ));
      }
    );*/
  }

  updateCalendarEvents(schedulerEvents: Array<SchedulerEventWithCustomerInfo>) {
    this.schedulerEvents = schedulerEvents;
    if (this.calendarApi) {
      this.calendarApi.refetchEvents();
    }
  }

  eventSourceFunction(arg: {
    start: Date;
    end: Date;
    timeZone: string;
  },                  successCallback: (events: EventInput[]) => void, failureCallback: (error: EventSourceError) => void) {
    const events: EventInput[] = [];
    if (this.schedulerEvents && this.schedulerEvents.length) {
      const start = toMoment(arg.start, this.calendarApi);
      const end = toMoment(arg.end, this.calendarApi);
      const userZone = getUserZone();
      const rangeStart = start.local();
      const rangeEnd = end.local();
      this.schedulerEvents.forEach((event) => {
        const startOffset = userZone.utcOffset(event.schedule.startTime) * 60 * 1000;
        const eventStart = window.moment(event.schedule.startTime - startOffset);
        let calendarEvent: EventInput;
        if (rangeEnd.isSameOrAfter(eventStart)) {
          if (event.schedule.repeat) {
            const endOffset = userZone.utcOffset(event.schedule.repeat.endsOn) * 60 * 1000;
            const repeatEndsOn = window.moment(event.schedule.repeat.endsOn - endOffset);
            if (event.schedule.repeat.type === SchedulerRepeatType.TIMER) {
              calendarEvent = this.toCalendarEvent(event,
                eventStart,
                repeatEndsOn);
              events.push(calendarEvent);
            } else {
              let currentTime: _moment.Moment;
              let eventStartOffsetUnits = 0;
              if (rangeStart.isSameOrBefore(eventStart)) {
                currentTime = eventStart.clone();
              } else {
                switch (event.schedule.repeat.type) {
                  case SchedulerRepeatType.YEARLY:
                  case SchedulerRepeatType.MONTHLY:
                    const eventStartOffsetDuration = window.moment.duration(rangeStart.diff(eventStart));
                    const offsetUnits = schedulerRepeatTypeToUnitMap.get(event.schedule.repeat.type);
                    eventStartOffsetUnits =
                      Math.ceil(eventStartOffsetDuration.as(offsetUnits));
                    currentTime = eventStart.clone().add(eventStartOffsetUnits, offsetUnits);
                    break;
                  default:
                    currentTime = rangeStart.clone();
                    currentTime.hours(eventStart.hours());
                    currentTime.minutes(eventStart.minutes());
                    currentTime.seconds(eventStart.seconds());
                }
              }
              let eventEnd;
              if (rangeEnd.isSameOrAfter(repeatEndsOn)) {
                eventEnd = repeatEndsOn.clone();
              } else {
                eventEnd = rangeEnd.clone();
              }
              while (currentTime.isBefore(eventEnd)) {
                const day = currentTime.day();
                if (event.schedule.repeat.type !== SchedulerRepeatType.WEEKLY ||
                  event.schedule.repeat.repeatOn.indexOf(day) !== -1) {
                  const currentEventStart = currentTime.clone();
                  calendarEvent = this.toCalendarEvent(event, currentEventStart);
                  events.push(calendarEvent);
                }
                switch (event.schedule.repeat.type) {
                  case SchedulerRepeatType.YEARLY:
                  case SchedulerRepeatType.MONTHLY:
                    eventStartOffsetUnits++;
                    currentTime = eventStart.clone()
                      .add(eventStartOffsetUnits, schedulerRepeatTypeToUnitMap.get(event.schedule.repeat.type));
                    break;
                  default:
                    currentTime.add(1, 'days');
                }
              }
            }
          } else if (rangeStart.isSameOrBefore(eventStart)) {
            calendarEvent = this.toCalendarEvent(event, eventStart);
            events.push(calendarEvent);
          }
        }
      });
      successCallback(events);
    } else {
      successCallback(events);
    }
  }

  private toCalendarEvent(event: SchedulerEventWithCustomerInfo, start: _moment.Moment, end?: _moment.Moment): EventInput {
    const title = `${event.name} - ${event.typeName}`;
    let htmlTitle = null;
    if (event.schedule.repeat && event.schedule.repeat.type === SchedulerRepeatType.TIMER) {
      const repeatInterval = this.translate.instant(schedulerTimeUnitRepeatTranslationMap.get(event.schedule.repeat.timeUnit),
        {count: event.schedule.repeat.repeatInterval});
      htmlTitle = ` <b>${repeatInterval}</b> ${title}`;
    }
    const calendarEvent: EventInput = {
      id: event.id.id,
      title,
      name: event.name,
      type: event.typeName,
      info: this.eventInfo(event),
      start: start.toDate(),
      end: end ? end.toDate() : null,
      htmlTitle
    };
    return calendarEvent;
  }

  private eventInfo(event: SchedulerEventWithCustomerInfo): string {
    let info = '';
    const startTime = event.schedule.startTime;
    if (!event.schedule.repeat) {
      const start = window.moment.utc(startTime).local().format('MMM DD, YYYY, hh:mma');
      info += start;
      return info;
    } else {
      info += window.moment.utc(startTime).local().format('hh:mma');
      info += '<br/>';
      info += this.translate.instant('scheduler.starting-from') + ' ' + window.moment.utc(startTime).local().format('MMM DD, YYYY') + ', ';
      if (event.schedule.repeat.type === SchedulerRepeatType.DAILY) {
        info += this.translate.instant('scheduler.daily') + ', ';
      } else if (event.schedule.repeat.type === SchedulerRepeatType.MONTHLY) {
        info += this.translate.instant('scheduler.monthly') + ', ';
      } else if (event.schedule.repeat.type === SchedulerRepeatType.YEARLY) {
        info += this.translate.instant('scheduler.yearly') + ', ';
      } else if (event.schedule.repeat.type === SchedulerRepeatType.TIMER) {
        const repeatInterval = this.translate.instant(schedulerTimeUnitRepeatTranslationMap.get(event.schedule.repeat.timeUnit),
          {count: event.schedule.repeat.repeatInterval});
        info += repeatInterval + ', ';
      } else {
        info += this.translate.instant('scheduler.weekly') + ' ' + this.translate.instant('scheduler.on') + ' ';
        event.schedule.repeat.repeatOn.forEach((day) => {
          info += this.translate.instant(schedulerWeekday[day]) + ', ';
        });
      }
      info += this.translate.instant('scheduler.until') + ' ';
      info += window.moment.utc(event.schedule.repeat.endsOn).local().format('MMM DD, YYYY');
      return info;
    }
  }

  private updatedRouterQueryParams(queryParams: object, queryParamsHandling: QueryParamsHandling = 'merge') {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling
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
      let fetchObservable: Observable<Array<SchedulerEventWithCustomerInfo>> = this.schedulerEventService.getSchedulerEvents(eventType);
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
