///
/// Copyright © 2022 ThingsBoard, Inc.
///

import { Component } from '@angular/core';
import { WidgetSettings, WidgetSettingsComponent } from '@shared/public-api';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppState } from '@core/public-api';
import { flotDefaultSettings } from './lem-flot-widget-settings.component';

@Component({
  selector: 'lem-flot-line-widget-settings',
  templateUrl: './lem-flot-line-widget-settings.component.html',
  styleUrls: []
})
export class LemFlotLineWidgetSettingsComponent extends WidgetSettingsComponent {

  flotLineWidgetSettingsForm: FormGroup;

  constructor(protected store: Store<AppState>,
              private fb: FormBuilder) {
    super(store);
  }

  protected settingsForm(): FormGroup {
    return this.flotLineWidgetSettingsForm;
  }

  protected defaultSettings(): WidgetSettings {
    return flotDefaultSettings('graph');
  }

  protected onSettingsSet(settings: WidgetSettings) {
    this.flotLineWidgetSettingsForm = this.fb.group({
      flotSettings: [settings.flotSettings, []]
    });
  }

  protected prepareInputSettings(settings: WidgetSettings): WidgetSettings {
    return {
      flotSettings: settings
    };
  }

  protected prepareOutputSettings(settings: any): WidgetSettings {
    return settings.flotSettings;
  }
}
