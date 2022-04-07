import {
  AfterViewInit,
  Component,
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef,
  forwardRef,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from '@app/core/core.state';
import { SchedulerEventConfiguration } from './scheduler-event.models';
import { cloneMetadata, deepClone } from '@core/public-api';
import { DynamicComponentFactoryService } from '@core/public-api';
import { CustomSchedulerEventConfigComponent } from '@home/components/scheduler/config/custom-scheduler-event-config.component';
import { SharedModule } from '@shared/shared.module';
import { SchedulerEventConfigType } from '@home/components/scheduler/scheduler-event-config.models';
import { tap } from 'rxjs/operators';
import { OtaUpdateEventConfigComponent } from '@home/components/scheduler/config/ota-update-event-config.component';

@Component({
  selector: 'tb-scheduler-event-template-config',
  template: '<ng-container #configContent></ng-container>',
  styleUrls: [],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SchedulerEventTemplateConfigComponent),
    multi: true
  }]
})
export class SchedulerEventTemplateConfigComponent implements ControlValueAccessor, OnInit, AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('configContent', {read: ViewContainerRef, static: true}) configContentContainer: ViewContainerRef;

  private configuration: SchedulerEventConfiguration | null;

  @Input()
  disabled: boolean;

  @Input()
  schedulerEventConfigTypes: {[eventType: string]: SchedulerEventConfigType};

  @Input()
  schedulerEventType: string;

  private customSchedulerEventConfigFactory: ComponentFactory<CustomSchedulerEventConfigComponent>;
  private configComponentRef: ComponentRef<ControlValueAccessor>;
  private configComponent: ControlValueAccessor;

  private propagateChange = (v: any) => { };

  constructor(private store: Store<AppState>,
              private dynamicComponentFactoryService: DynamicComponentFactoryService,
              private injector: Injector,
              private resolver: ComponentFactoryResolver) {
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  ngOnInit() {
    this.loadTemplate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propName of Object.keys(changes)) {
      const change = changes[propName];
      if (!change.firstChange && change.currentValue !== change.previousValue) {
        if (propName === 'schedulerEventType') {
          this.loadTemplate();
        }
      }
    }
  }

  private loadTemplate() {
    if (this.configComponentRef) {
      this.configComponentRef.destroy();
      this.configComponentRef = null;
      this.configComponent = null;
    }
    if (this.customSchedulerEventConfigFactory) {
      this.dynamicComponentFactoryService.destroyDynamicComponentFactory(this.customSchedulerEventConfigFactory);
      this.customSchedulerEventConfigFactory = null;
    }
    if (this.schedulerEventType) {
      let template = '<div>Not defined!</div>';
      let componentType: Type<ControlValueAccessor>;
      const configType = this.schedulerEventConfigTypes[this.schedulerEventType];
      if (configType) {
        if (configType.componentType) {
          componentType = configType.componentType;
          // template = `<${selector} [(ngModel)]="configuration"></${selector}>`;
        } else if (configType.template) {
          template = configType.template;
        }
      }
      this.resolveComponentFactory(componentType, template).subscribe((factory) => {
        this.configContentContainer.clear();
        this.configComponentRef = this.configContentContainer.createComponent(factory);
        this.configComponent = this.configComponentRef.instance;
        if (this.configComponent instanceof OtaUpdateEventConfigComponent) {
          this.configComponent.schedulerEventType = this.schedulerEventType;
        }
        this.configComponent.registerOnChange((configuration: SchedulerEventConfiguration) => {
          this.updateModel(configuration);
        });
        this.configComponent.setDisabledState(this.disabled);
        this.configComponent.writeValue(this.configuration);
      });
    }
  }

  private resolveComponentFactory(componentType: Type<ControlValueAccessor>,
                                  template: string): Observable<ComponentFactory<ControlValueAccessor|OtaUpdateEventConfigComponent>> {
    if (componentType) {
      const factory = this.resolver.resolveComponentFactory(componentType);
      return of(factory);
    } else if (template) {
      class CustomSchedulerEventConfigComponentInstance extends CustomSchedulerEventConfigComponent {
      }
      cloneMetadata(CustomSchedulerEventConfigComponent, CustomSchedulerEventConfigComponentInstance);
      return this.dynamicComponentFactoryService.createDynamicComponentFactory(
        CustomSchedulerEventConfigComponentInstance,
        template,
        [SharedModule]).pipe(
        tap((factory: ComponentFactory<CustomSchedulerEventConfigComponent>) => {
          this.customSchedulerEventConfigFactory = factory;
        })
      );
    } else {
      return of(null);
    }
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    if (this.configComponentRef) {
      this.configComponentRef.destroy();
    }
    if (this.customSchedulerEventConfigFactory) {
      this.dynamicComponentFactoryService.destroyDynamicComponentFactory(this.customSchedulerEventConfigFactory);
    }
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.configComponent) {
      this.configComponent.setDisabledState(isDisabled);
    }
  }

  writeValue(value: SchedulerEventConfiguration | null): void {
    this.configuration = deepClone(value);
    if (this.configComponent) {
      this.configComponent.writeValue(this.configuration);
    }
  }

  private updateModel(configuration: SchedulerEventConfiguration) {
    this.propagateChange(configuration);
  }

}
