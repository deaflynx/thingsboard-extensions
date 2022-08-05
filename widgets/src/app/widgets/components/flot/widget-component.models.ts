///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { IDashboardComponent } from '@home/models/dashboard-component.models';
import {
  DataSet,
  Datasource,
  DatasourceData, FormattedData,
  JsonSettingsSchema,
  Widget,
  WidgetActionDescriptor,
  WidgetActionSource,
  WidgetConfig,
  WidgetControllerDescriptor,
  WidgetType,
  widgetType,
  WidgetTypeDescriptor,
  WidgetTypeDetails,
  WidgetTypeParameters
} from '@shared/public-api';
import { Timewindow, WidgetTimewindow } from '@shared/public-api';
import {
  IAliasController,
  IStateController,
  IWidgetSubscription,
  IWidgetUtils,
  RpcApi, StateParams,
  SubscriptionEntityInfo,
  TimewindowFunctions,
  WidgetActionsApi,
  WidgetSubscriptionApi
} from '@core/public-api';
import { ChangeDetectorRef, ComponentFactory, Injector, NgZone, Type } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { RafService } from '@core/public-api';
import { WidgetTypeId } from '@shared/public-api';
import { TenantId } from '@shared/public-api';
import { WidgetLayout } from '@shared/public-api';
import { formatValue, isDefined } from '@core/public-api';
import { Store } from '@ngrx/store';
import { AppState } from '@core/public-api';
import { ActionNotificationHide, ActionNotificationShow } from './notification.actions';
import { AuthUser } from '@shared/public-api';
import { getCurrentAuthUser } from '@core/auth/auth.selectors';
import { DeviceService } from '@core/public-api';
import { AssetService } from '@core/public-api';
import { EntityViewService } from '@core/public-api';
import { CustomerService } from '@core/public-api';
import { DashboardService } from '@core/public-api';
import { UserService } from '@core/public-api';
import { AttributeService } from '@core/public-api';
import { EntityRelationService } from '@core/public-api';
import { EntityService } from '@core/public-api';
import { DialogService } from '@core/services/dialog.service';
import { AuthService } from '@core/auth/auth.service';
import { ResourceService } from '@core/public-api';
import { DatePipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { PageLink } from '@shared/public-api';
import { SortOrder } from '@shared/public-api';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import * as RxJS from 'rxjs';
import * as RxJSOperators from 'rxjs/operators';
import { TbPopoverComponent } from '@shared/components/popover.component';
import { EntityId } from '@shared/public-api';
import { LemFlot } from './flot-widget.component';

export declare type NotificationType = 'info' | 'warn' | 'success' | 'error';
export declare type NotificationHorizontalPosition = 'start' | 'center' | 'end' | 'left' | 'right';
export declare type NotificationVerticalPosition = 'top' | 'bottom';

export interface IWidgetAction {
  name: string;
  icon: string;
  onAction: ($event: Event) => void;
}

export type ShowWidgetHeaderActionFunction = (ctx: WidgetContext, data: FormattedData[]) => boolean;

export interface WidgetHeaderAction extends IWidgetAction {
  displayName: string;
  descriptor: WidgetActionDescriptor;
  useShowWidgetHeaderActionFunction: boolean;
  showWidgetHeaderActionFunction: ShowWidgetHeaderActionFunction;
}

export interface WidgetAction extends IWidgetAction {
  show: boolean;
}

export interface IDashboardWidget {
  updateWidgetParams();
}

export class WidgetContext {

  constructor(public dashboard: IDashboardComponent,
              private dashboardWidget: IDashboardWidget,
              private widget: Widget,
              public parentDashboard?: IDashboardComponent) {}

  get stateController(): IStateController {
    return this.parentDashboard ? this.parentDashboard.stateController : this.dashboard.stateController;
  }

  get aliasController(): IAliasController {
    return this.dashboard.aliasController;
  }

  get dashboardTimewindow(): Timewindow {
    return this.dashboard.dashboardTimewindow;
  }

  get widgetConfig(): WidgetConfig {
    return this.widget.config;
  }

  get settings(): any {
    return this.widget.config.settings;
  }

  get units(): string {
    return this.widget.config.units || '';
  }

  get decimals(): number {
    return isDefined(this.widget.config.decimals) ? this.widget.config.decimals : 2;
  }

  set changeDetector(cd: ChangeDetectorRef) {
    this.changeDetectorValue = cd;
  }

  set containerChangeDetector(cd: ChangeDetectorRef) {
    this.containerChangeDetectorValue = cd;
  }

  get currentUser(): AuthUser {
    if (this.store) {
      return getCurrentAuthUser(this.store);
    } else {
      return null;
    }
  }

  authService: AuthService;
  deviceService: DeviceService;
  assetService: AssetService;
  entityViewService: EntityViewService;
  customerService: CustomerService;
  dashboardService: DashboardService;
  userService: UserService;
  attributeService: AttributeService;
  entityRelationService: EntityRelationService;
  entityService: EntityService;
  dialogs: DialogService;
  resourceService: ResourceService;
  date: DatePipe;
  translate: TranslateService;
  http: HttpClient;
  sanitizer: DomSanitizer;
  router: Router;
  flot: LemFlot;

  private changeDetectorValue: ChangeDetectorRef;
  private containerChangeDetectorValue: ChangeDetectorRef;

  inited = false;
  destroyed = false;

  subscriptions: {[id: string]: IWidgetSubscription} = {};
  defaultSubscription: IWidgetSubscription = null;

  timewindowFunctions: TimewindowFunctions = {
    onUpdateTimewindow: (startTimeMs, endTimeMs, interval) => {
      if (this.defaultSubscription) {
        this.defaultSubscription.onUpdateTimewindow(startTimeMs, endTimeMs, interval);
      }
    },
    onResetTimewindow: () => {
      if (this.defaultSubscription) {
        this.defaultSubscription.onResetTimewindow();
      }
    }
  };

  controlApi: RpcApi = {
    sendOneWayCommand: (method, params, timeout, persistent,
                        retries, additionalInfo, requestUUID) => {
      if (this.defaultSubscription) {
        return this.defaultSubscription.sendOneWayCommand(method, params, timeout, persistent, retries, additionalInfo, requestUUID);
      } else {
        return RxJS.of(null);
      }
    },
    sendTwoWayCommand: (method, params, timeout, persistent,
                        retries, additionalInfo, requestUUID) => {
      if (this.defaultSubscription) {
        return this.defaultSubscription.sendTwoWayCommand(method, params, timeout, persistent, retries, additionalInfo, requestUUID);
      } else {
        return RxJS.of(null);
      }
    },
    completedCommand: () => {
      if (this.defaultSubscription) {
        return this.defaultSubscription.completedCommand();
      } else {
        return RxJS.of(null);
      }
    }
  };

  utils: IWidgetUtils = {
    formatValue
  };

  $container: JQuery<HTMLElement>;
  $containerParent: JQuery<HTMLElement>;
  width: number;
  height: number;
  $scope: IDynamicWidgetComponent;
  isEdit: boolean;
  isMobile: boolean;
  toastTargetId: string;

  widgetNamespace?: string;
  subscriptionApi?: WidgetSubscriptionApi;

  actionsApi?: WidgetActionsApi;
  activeEntityInfo?: SubscriptionEntityInfo;

  datasources?: Array<Datasource>;
  data?: Array<DatasourceData>;
  latestData?: Array<DatasourceData>;
  hiddenData?: Array<{data: DataSet}>;
  timeWindow?: WidgetTimewindow;

  hideTitlePanel = false;

  widgetTitle?: string;
  widgetTitleTooltip?: string;
  customHeaderActions?: Array<WidgetHeaderAction>;
  widgetActions?: Array<WidgetAction>;

  servicesMap?: Map<string, Type<any>>;

  $injector?: Injector;

  ngZone?: NgZone;

  store?: Store<AppState>;

  private popoverComponents: TbPopoverComponent[] = [];

  rxjs = {

    ...RxJS,
    ...RxJSOperators
  };

  registerPopoverComponent(popoverComponent: TbPopoverComponent) {
    this.popoverComponents.push(popoverComponent);
    popoverComponent.tbDestroy.subscribe(() => {
      const index = this.popoverComponents.indexOf(popoverComponent, 0);
      if (index > -1) {
        this.popoverComponents.splice(index, 1);
      }
    });
  }

  updatePopoverPositions() {
    this.popoverComponents.forEach(comp => {
      comp.updatePosition();
    });
  }

  setPopoversHidden(hidden: boolean) {
    this.popoverComponents.forEach(comp => {
      comp.tbHidden = hidden;
    });
  }

  showSuccessToast(message: string, duration: number = 1000,
                   verticalPosition: NotificationVerticalPosition = 'bottom',
                   horizontalPosition: NotificationHorizontalPosition = 'left',
                   target: string = 'dashboardRoot') {
    this.showToast('success', message, duration, verticalPosition, horizontalPosition, target);
  }

  showInfoToast(message: string,
                verticalPosition: NotificationVerticalPosition = 'bottom',
                horizontalPosition: NotificationHorizontalPosition = 'left',
                target: string = 'dashboardRoot') {
    this.showToast('info', message, undefined, verticalPosition, horizontalPosition, target);
  }

  showWarnToast(message: string,
                verticalPosition: NotificationVerticalPosition = 'bottom',
                horizontalPosition: NotificationHorizontalPosition = 'left',
                target: string = 'dashboardRoot') {
    this.showToast('warn', message, undefined, verticalPosition, horizontalPosition, target);
  }

  showErrorToast(message: string,
                 verticalPosition: NotificationVerticalPosition = 'bottom',
                 horizontalPosition: NotificationHorizontalPosition = 'left',
                 target: string = 'dashboardRoot') {
    this.showToast('error', message, undefined, verticalPosition, horizontalPosition, target);
  }

  showToast(type: NotificationType, message: string, duration: number,
            verticalPosition: NotificationVerticalPosition = 'bottom',
            horizontalPosition: NotificationHorizontalPosition = 'left',
            target: string = 'dashboardRoot') {
    this.store.dispatch(new ActionNotificationShow(
      {
        message,
        type,
        duration,
        verticalPosition,
        horizontalPosition,
        target,
        panelClass: this.widgetNamespace,
        forceDismiss: true
      }));
  }

  hideToast(target?: string) {
    this.store.dispatch(new ActionNotificationHide(
      {
        target,
      }));
  }

  detectChanges(updateWidgetParams: boolean = false) {
    if (!this.destroyed) {
      if (updateWidgetParams) {
        this.dashboardWidget.updateWidgetParams();
      }
      try {
        this.changeDetectorValue.detectChanges();
      } catch (e) {
        // console.log(e);
      }
    }
  }

  detectContainerChanges() {
    if (!this.destroyed) {
      try {
        this.containerChangeDetectorValue.detectChanges();
      } catch (e) {
        // console.log(e);
      }
    }
  }

  updateWidgetParams() {
    if (!this.destroyed) {
      setTimeout(() => {
        this.dashboardWidget.updateWidgetParams();
      }, 0);
    }
  }

  updateAliases(aliasIds?: Array<string>) {
    this.aliasController.updateAliases(aliasIds);
  }

  reset() {
    this.destroyed = false;
    this.hideTitlePanel = false;
    this.widgetTitle = undefined;
    this.widgetActions = undefined;
  }

  pageLink(pageSize: number, page: number = 0, textSearch: string = null, sortOrder: SortOrder = null): PageLink {
    return new PageLink(pageSize, page, textSearch, sortOrder);
  }
}

export interface IDynamicWidgetComponent {
  readonly ctx: WidgetContext;
  readonly errorMessages: string[];
  readonly $injector: Injector;
  executingRpcRequest: boolean;
  rpcEnabled: boolean;
  rpcErrorText: string;
  rpcRejection: HttpErrorResponse;
  raf: RafService;
  [key: string]: any;
}

export interface WidgetInfo extends WidgetTypeDescriptor, WidgetControllerDescriptor {
  widgetName: string;
  alias: string;
  typeSettingsSchema?: string | any;
  typeDataKeySettingsSchema?: string | any;
  typeLatestDataKeySettingsSchema?: string | any;
  image?: string;
  description?: string;
  componentFactory?: ComponentFactory<IDynamicWidgetComponent>;
}

export interface WidgetConfigComponentData {
  config: WidgetConfig;
  layout: WidgetLayout;
  widgetType: widgetType;
  typeParameters: WidgetTypeParameters;
  actionSources: {[actionSourceId: string]: WidgetActionSource};
  isDataEnabled: boolean;
  settingsSchema: JsonSettingsSchema;
  dataKeySettingsSchema: JsonSettingsSchema;
  latestDataKeySettingsSchema: JsonSettingsSchema;
  settingsDirective: string;
  dataKeySettingsDirective: string;
  latestDataKeySettingsDirective: string;
}

export const MissingWidgetType: WidgetInfo = {
  type: widgetType.latest,
  widgetName: 'Widget type not found',
  alias: 'undefined',
  sizeX: 8,
  sizeY: 6,
  resources: [],
  templateHtml: '<div class="tb-widget-error-container">' +
    '<div class="tb-widget-error-msg" innerHTML="{{\'widget.widget-type-not-found\' | translate }}"></div>' +
    '</div>',
  templateCss: '',
  controllerScript: 'self.onInit = function() {}',
  settingsSchema: '{}\n',
  dataKeySettingsSchema: '{}\n',
  image: null,
  description: null,
  defaultConfig: '{\n' +
    '"title": "Widget type not found",\n' +
    '"datasources": [],\n' +
    '"settings": {}\n' +
    '}\n',
  typeParameters: {}
};

export const ErrorWidgetType: WidgetInfo = {
  type: widgetType.latest,
  widgetName: 'Error loading widget',
  alias: 'error',
  sizeX: 8,
  sizeY: 6,
  resources: [],
  templateHtml: '<div class="tb-widget-error-container">' +
    '<div translate class="tb-widget-error-msg">widget.widget-type-load-error</div>' +
    '<div *ngFor="let error of errorMessages" class="tb-widget-error-msg">{{ error }}</div>' +
    '</div>',
  templateCss: '',
  controllerScript: 'self.onInit = function() {}',
  settingsSchema: '{}\n',
  dataKeySettingsSchema: '{}\n',
  image: null,
  description: null,
  defaultConfig: '{\n' +
    '"title": "Widget failed to load",\n' +
    '"datasources": [],\n' +
    '"settings": {}\n' +
    '}\n',
  typeParameters: {}
};

export interface WidgetTypeInstance {
  getSettingsSchema?: () => string;
  getDataKeySettingsSchema?: () => string;
  getLatestDataKeySettingsSchema?: () => string;
  typeParameters?: () => WidgetTypeParameters;
  useCustomDatasources?: () => boolean;
  actionSources?: () => {[actionSourceId: string]: WidgetActionSource};

  onInit?: () => void;
  onDataUpdated?: () => void;
  onLatestDataUpdated?: () => void;
  onResize?: () => void;
  onEditModeChanged?: () => void;
  onMobileModeChanged?: () => void;
  onDestroy?: () => void;
}

export function detailsToWidgetInfo(widgetTypeDetailsEntity: WidgetTypeDetails): WidgetInfo {
  const widgetInfo = toWidgetInfo(widgetTypeDetailsEntity);
  widgetInfo.image = widgetTypeDetailsEntity.image;
  widgetInfo.description = widgetTypeDetailsEntity.description;
  return widgetInfo;
}

export function toWidgetInfo(widgetTypeEntity: WidgetType): WidgetInfo {
  return {
    widgetName: widgetTypeEntity.name,
    alias: widgetTypeEntity.alias,
    type: widgetTypeEntity.descriptor.type,
    sizeX: widgetTypeEntity.descriptor.sizeX,
    sizeY: widgetTypeEntity.descriptor.sizeY,
    resources: widgetTypeEntity.descriptor.resources,
    templateHtml: widgetTypeEntity.descriptor.templateHtml,
    templateCss: widgetTypeEntity.descriptor.templateCss,
    controllerScript: widgetTypeEntity.descriptor.controllerScript,
    settingsSchema: widgetTypeEntity.descriptor.settingsSchema,
    dataKeySettingsSchema: widgetTypeEntity.descriptor.dataKeySettingsSchema,
    latestDataKeySettingsSchema: widgetTypeEntity.descriptor.latestDataKeySettingsSchema,
    settingsDirective: widgetTypeEntity.descriptor.settingsDirective,
    dataKeySettingsDirective: widgetTypeEntity.descriptor.dataKeySettingsDirective,
    latestDataKeySettingsDirective: widgetTypeEntity.descriptor.latestDataKeySettingsDirective,
    defaultConfig: widgetTypeEntity.descriptor.defaultConfig
  };
}

export function toWidgetTypeDetails(widgetInfo: WidgetInfo, id: WidgetTypeId, tenantId: TenantId,
                                    bundleAlias: string, createdTime: number): WidgetTypeDetails {
  const widgetTypeEntity = toWidgetType(widgetInfo, id, tenantId, bundleAlias, createdTime);
  const widgetTypeDetails: WidgetTypeDetails = {...widgetTypeEntity,
    description: widgetInfo.description,
    image: widgetInfo.image
  };
  return widgetTypeDetails;
}

export function toWidgetType(widgetInfo: WidgetInfo, id: WidgetTypeId, tenantId: TenantId,
                             bundleAlias: string, createdTime: number): WidgetType {
  const descriptor: WidgetTypeDescriptor = {
    type: widgetInfo.type,
    sizeX: widgetInfo.sizeX,
    sizeY: widgetInfo.sizeY,
    resources: widgetInfo.resources,
    templateHtml: widgetInfo.templateHtml,
    templateCss: widgetInfo.templateCss,
    controllerScript: widgetInfo.controllerScript,
    settingsSchema: widgetInfo.settingsSchema,
    dataKeySettingsSchema: widgetInfo.dataKeySettingsSchema,
    latestDataKeySettingsSchema: widgetInfo.latestDataKeySettingsSchema,
    settingsDirective: widgetInfo.settingsDirective,
    dataKeySettingsDirective: widgetInfo.dataKeySettingsDirective,
    latestDataKeySettingsDirective: widgetInfo.latestDataKeySettingsDirective,
    defaultConfig: widgetInfo.defaultConfig
  };
  return {
    id,
    tenantId,
    createdTime,
    bundleAlias,
    alias: widgetInfo.alias,
    name: widgetInfo.widgetName,
    descriptor
  };
}

export function updateEntityParams(params: StateParams, targetEntityParamName?: string, targetEntityId?: EntityId,
                                   entityName?: string, entityLabel?: string) {
  if (targetEntityId) {
    let targetEntityParams: StateParams;
    if (targetEntityParamName && targetEntityParamName.length) {
      targetEntityParams = params[targetEntityParamName];
      if (!targetEntityParams) {
        targetEntityParams = {};
        params[targetEntityParamName] = targetEntityParams;
        params.targetEntityParamName = targetEntityParamName;
      }
    } else {
      targetEntityParams = params;
    }
    targetEntityParams.entityId = targetEntityId;
    if (entityName) {
      targetEntityParams.entityName = entityName;
    }
    if (entityLabel) {
      targetEntityParams.entityLabel = entityLabel;
    }
  }
}
