///
/// Copyright © 2021 ThingsBoard, Inc.
///

export enum schedulerCalendarView {
  month = 'month',
  week = 'week',
  day = 'day',
  listYear = 'listYear',
  listMonth = 'listMonth',
  listWeek = 'listWeek',
  listDay = 'listDay',
  agendaWeek = 'agendaWeek',
  agendaDay = 'agendaDay'
}

export const schedulerCalendarViewValueMap = new Map<schedulerCalendarView, string>(
  [
    [schedulerCalendarView.month, 'dayGridMonth'],
    [schedulerCalendarView.week, 'dayGridWeek'],
    [schedulerCalendarView.day, 'dayGridDay'],
    [schedulerCalendarView.listYear, 'listYear'],
    [schedulerCalendarView.listMonth, 'listMonth'],
    [schedulerCalendarView.listWeek, 'listWeek'],
    [schedulerCalendarView.listDay, 'listDay'],
    [schedulerCalendarView.agendaWeek, 'timeGridWeek'],
    [schedulerCalendarView.agendaDay, 'timeGridDay']
  ]
);

export const schedulerCalendarViewTranslationMap = new Map<schedulerCalendarView, string>(
  [
    [schedulerCalendarView.month, 'scheduler.month'],
    [schedulerCalendarView.week, 'scheduler.week'],
    [schedulerCalendarView.day, 'scheduler.day'],
    [schedulerCalendarView.listYear, 'scheduler.list-year'],
    [schedulerCalendarView.listMonth, 'scheduler.list-month'],
    [schedulerCalendarView.listWeek, 'scheduler.list-week'],
    [schedulerCalendarView.listDay, 'scheduler.list-day'],
    [schedulerCalendarView.agendaWeek, 'scheduler.agenda-week'],
    [schedulerCalendarView.agendaDay, 'scheduler.agenda-day']
  ]
);

export interface SchedulerEventsWidgetSettings {
  title: string;
  displayCreatedTime: boolean;
  displayType: boolean;
  displayCustomer: boolean;
  displayPagination: boolean;
  defaultPageSize: number;
  defaultSortOrder: string;
  enabledViews: 'both' | 'list' | 'calendar';
  forceDefaultEventType: string;
  noDataDisplayMessage: string;
  customEventTypes: {
    name: string;
    value: string;
    originator: boolean;
    msgType: boolean;
    metadata: boolean;
    template: string;
  }[]
}
