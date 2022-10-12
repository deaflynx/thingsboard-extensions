///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {WidgetContext} from '@home/models/widget-component.models';
import {RuleChain, RuleChainMetaData} from "@shared/models/rule-chain.models";
import {PageLink} from '@shared/models/page/page-link';
import {PageData} from '@shared/models/page/page-data';
import {forkJoin, Observable} from 'rxjs';
import {FormBuilder, Validators} from '@angular/forms';
import {map, switchMap} from "rxjs/operators";
import {group} from "@angular/animations";
import {AttributeData, EntityId, initModelFromDefaultTimewindow} from "@shared/public-api";

interface idsMap {
  [name: string]: {
    newId: string,
    oldId: string,
    root?: boolean
  }
}

enum EntityType {
  TENANT = "TENANT",
  TENANT_PROFILE = "TENANT_PROFILE",
  CUSTOMER = "CUSTOMER",
  USER = "USER",
  DASHBOARD = "DASHBOARD",
  ASSET = "ASSET",
  DEVICE = "DEVICE",
  DEVICE_PROFILE = "DEVICE_PROFILE",
  ALARM = "ALARM",
  ENTITY_GROUP = "ENTITY_GROUP",
  CONVERTER = "CONVERTER",
  INTEGRATION = "INTEGRATION",
  RULE_CHAIN = "RULE_CHAIN",
  RULE_NODE = "RULE_NODE",
  SCHEDULER_EVENT = "SCHEDULER_EVENT",
  BLOB_ENTITY = "BLOB_ENTITY",
  ENTITY_VIEW = "ENTITY_VIEW",
  WIDGETS_BUNDLE = "WIDGETS_BUNDLE",
  WIDGET_TYPE = "WIDGET_TYPE",
  ROLE = "ROLE",
  GROUP_PERMISSION = "GROUP_PERMISSION",
  API_USAGE_STATE = "API_USAGE_STATE",
  TB_RESOURCE = "TB_RESOURCE",
  EDGE = "EDGE",
  OTA_PACKAGE = "OTA_PACKAGE",
  RPC = "RPC"
}

@Component({
  selector: 'tb-migration-customer',
  templateUrl: './tb-migration-customer.component.html',
  styleUrls: ['./tb-migration-customer.component.scss']
})


export class TbMigrationCustomerComponent implements AfterViewInit, OnInit {

  @ViewChild('Chart') chart: ElementRef;

  private AUTH_SCHEME = 'Bearer ';
  private AUTH_HEADER_NAME = 'X-Authorization';


  //example values
  private targetUrl = "";
  private targetUsername = "";
  private targetPassword = "";

  private authToken = null;

  private startBl = false;


  @Input()
  ctx: WidgetContext;

  @Input()
  alarmService: any;

  private RuleChainType = {
    CORE: "CORE",
    EDGE: "EDGE"
  }

  result = "In progress";

  progress = 0;

  urlRegex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+(?:\/)+$/;


  migrationForumGroup = this.fb.group({
    targetUsername: 'migration_customer@test.com',
    targetPassword: '1728549Maks',
    targetUrl: ['https://sandbox.imsense.io/', [Validators.required, Validators.pattern(this.urlRegex)]]
  });

  isLoading = false;

  constructor(public fb: FormBuilder) {
  }

  start() {
    this.result = "In progress";
    this.progress = 0;
    this.isLoading = true;
    const metadataBody: RuleChainMetaData = {
      ruleChainId: null,
      nodes: [{
        type: "org.thingsboard.rule.engine.flow.TbRuleChainInputNode",
        name: "s",
        configuration: {ruleChainId: "d3edfb40-e0c9-11ec-903d-bfd909f2babc"},
        additionalInfo: {description: "", "layoutX": 508, "layoutY": 174},
        debugMode: false
      }],
      connections: [],
      firstNodeIndex: 0
    };

    this.targetUrl = this.migrationForumGroup.value.targetUrl;
    this.targetUsername = this.migrationForumGroup.value.targetUsername;
    this.targetPassword = this.migrationForumGroup.value.targetPassword;

    const pageLink: PageLink = this.ctx.pageLink(100);
    const getRuleChains: Observable<PageData<RuleChain>> = this.ctx.http.get<PageData<RuleChain>>(`/api/ruleChains${pageLink.toQuery()}&type=${this.RuleChainType.CORE}`, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + localStorage.getItem("jwt_token"),
        'Content-Type': 'application/json'
      }
    });
    const metadataRequest: Observable<RuleChainMetaData> = this.ctx.http.post<RuleChainMetaData>("api/ruleChain/metadata", metadataBody, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + localStorage.getItem("jwt_token"),
        'Content-Type': 'application/json'
      }
    });
    this.isLoading = true;


    this.getToken(this.targetUsername, this.targetPassword).subscribe(resp => {
      this.authToken = resp.token;
      //Assets migration
      this.progress = 25;
      this.result = "Migrating Assets";
      this.ctx.detectChanges();
      this.ctx.entityGroupService.getEntityGroups(EntityType.ASSET).subscribe(groups => {
        const allGroup = groups.find(group => group.name === "All");
        this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
          const createEntitiesRequests = [];
          const createGroupsRequests = [];
          groups.forEach(group => {
            if (group.name !== "All" && group.ownerId.entityType === "CUSTOMER") {
              createGroupsRequests.push(this.createEntityGroup({type: group.type, name: group.name}))
            }
          })
          allEntities.data.forEach(asset => {
            // @ts-ignore
            if (asset.device_profile !== "TbServiceQueue") createEntitiesRequests.push(this.createAsset({
              name: asset.name,
              // @ts-ignore
              type: asset.device_profile,
              label: asset.label || null,
              additionalInfo: {
                description: ""
              }

            }))
          })
          forkJoin(...createEntitiesRequests, ...createGroupsRequests)
            .subscribe(created => {
              const getGroupsEntities = [];
              groups.forEach(group => {
                if (group.name !== "All" && group.ownerId.entityType === "CUSTOMER") {
                  getGroupsEntities.push(this.ctx.entityGroupService.getEntityGroupEntities(group.id.id, this.ctx.pageLink(10000))
                    .pipe(map(res => { // @ts-ignore
                      res.name = group.name;
                      return res
                    })))
                }
              })
              forkJoin(getGroupsEntities).subscribe((groupInfo: Array<{ data: Array<any>, name: string }>) => {
                const assignEntitiesToGroup = [];
                groupInfo.forEach(info => {
                  if (info.data.length) {
                    const groupIds = []
                    info.data.forEach(gInfo => {
                      groupIds.push(created.find(newEntities => newEntities.name === gInfo.name).id.id)
                    })
                    assignEntitiesToGroup.push(this.addEntitiesToEntityGroup(created.find(group => group.name === info.name).id.id, groupIds))
                  }
                })

                forkJoin(...assignEntitiesToGroup).subscribe(assigned => {

                  //Dashboard migration
                  this.progress = 50;
                  this.result = "Migrating Dashboards";
                  this.ctx.detectChanges();
                  this.ctx.entityGroupService.getEntityGroups(EntityType.DASHBOARD).subscribe(groups => {
                    const allGroup = groups.find(group => group.name === "All");
                    this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
                      const createEntitiesRequests = [];
                      const createGroupsRequests = [];
                      groups.forEach(group => {
                        if (group.name !== "All" && group.ownerId.entityType === "CUSTOMER") {
                          createGroupsRequests.push(this.createEntityGroup({
                            type: group.type,
                            name: group.name
                          }))
                        }
                      })
                      const dashboardConfig = [];
                      allEntities.data.forEach(oldDashboard => {
                        // @ts-ignore
                        dashboardConfig.push(this.ctx.dashboardService.getDashboard(oldDashboard.id.id))
                      })
                      forkJoin(...dashboardConfig)
                        .subscribe(config => {
                          config.forEach(cfg => {
                            delete cfg.id;
                            delete cfg.ownerId;
                            delete cfg.tenantId;
                            delete cfg.customerId;
                            createEntitiesRequests.push(this.createDashboard(cfg))
                          })
                          forkJoin(...createEntitiesRequests, ...createGroupsRequests)
                            .subscribe(created => {
                              const getGroupsEntities = [];
                              groups.forEach(group => {
                                if (group.name !== "All" && group.ownerId.entityType === "CUSTOMER") {
                                  getGroupsEntities.push(this.ctx.entityGroupService.getEntityGroupEntities(group.id.id, this.ctx.pageLink(10000))
                                    .pipe(map(res => { // @ts-ignore
                                      res.name = group.name;
                                      return res
                                    })))
                                }
                              })
                              forkJoin(getGroupsEntities).subscribe((groupInfo: Array<{ data: Array<any>, name: string }>) => {
                                const technicalAssets = [];
                                const assignEntitiesToGroup = [];
                                groupInfo.forEach(info => {
                                  if (info.data.length) {
                                    const groupIds = []
                                    info.data.forEach(gInfo => {
                                      // @ts-ignore
                                      technicalAssets.push(this.ctx.attributeService.getEntityAttributes(gInfo.id, "SERVER_SCOPE")
                                        .pipe(map(res => { // @ts-ignore
                                          if (res) res.push(created.find(newEntities => newEntities.title === gInfo.title).id);
                                          return res
                                        })));
                                      groupIds.push(created.find(newEntities => newEntities.title === gInfo.title).id.id)
                                    })
                                    assignEntitiesToGroup.push(this.addEntitiesToEntityGroup(created.find(group => group.name === info.name).id.id, groupIds))
                                  }
                                })
                                forkJoin(...assignEntitiesToGroup, ...technicalAssets).subscribe(assigned => {
                                  const saveAttr = [];
                                  assigned.forEach((attrResp, index) => {
                                    if (attrResp && attrResp.length > 1) {
                                      saveAttr.push(this.saveAttributes(attrResp[attrResp.length - 1] as EntityId, attrResp.filter(el => !el.id)))

                                    }
                                  })
                                  forkJoin(...saveAttr).subscribe(finalAssets => {

                                    //Devices migration
                                    this.progress = 75;
                                    this.result = "Migrating Devices";
                                    this.ctx.detectChanges();
                                    this.getDeviceProfilesInfo().subscribe(profiles => {
                                      this.ctx.entityGroupService.getEntityGroups(EntityType.DEVICE).subscribe(groups => {
                                        const allGroup = groups.find(group => group.name === "All");
                                        this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
                                          const createEntitiesRequests = [];
                                          const createGroupsRequests = [];
                                          groups.forEach(group => {
                                            if (group.name !== "All" && group.ownerId.entityType === "CUSTOMER") {
                                              createGroupsRequests.push(this.createEntityGroup({
                                                type: group.type,
                                                name: group.name
                                              }))
                                            }
                                          })
                                          allEntities.data.forEach(device => {
                                            let deviceBody = {
                                              name: device.name,
                                              label: device.label || null,
                                              additionalInfo: {
                                                description: ""
                                              }
                                            }
                                            // @ts-ignore
                                            const deviceProfileId = profiles.data.find(profile => profile.name === device.device_profile);
                                            if (deviceProfileId) {
                                              // @ts-ignore
                                              deviceBody.deviceProfileId = deviceProfileId.id;
                                              // @ts-ignore
                                            } else deviceBody.type = device.device_profile;
                                            // @ts-ignore
                                            createEntitiesRequests.push(this.createDevice(deviceBody))
                                          })
                                          forkJoin(...createEntitiesRequests, ...createGroupsRequests)
                                            .subscribe(created => {
                                              const getGroupsEntities = [];
                                              groups.forEach(group => {
                                                if (group.name !== "All") {
                                                  getGroupsEntities.push(this.ctx.entityGroupService.getEntityGroupEntities(group.id.id, this.ctx.pageLink(10000))
                                                    .pipe(map(res => { // @ts-ignore
                                                      res.name = group.name;
                                                      return res
                                                    })))
                                                }
                                              })
                                              forkJoin(getGroupsEntities).subscribe((groupInfo: Array<{ data: Array<any>, name: string }>) => {
                                                const assignEntitiesToGroup = [];
                                                groupInfo.forEach(info => {
                                                  if (info.data.length) {
                                                    const groupIds = []
                                                    info.data.forEach(gInfo => {
                                                      groupIds.push(created.find(newEntities => newEntities.name === gInfo.name).id.id)
                                                    })
                                                    assignEntitiesToGroup.push(this.addEntitiesToEntityGroup(created.find(group => group.name === info.name).id.id, groupIds))
                                                  }
                                                })
                                                if (!assignEntitiesToGroup.length) {
                                                  this.result = "Migration has been completed successfully";
                                                  this.progress = 100;
                                                  this.ctx.detectChanges();
                                                  setTimeout(() => {
                                                    this.isLoading = false;
                                                    this.ctx.detectChanges();
                                                  }, 3000);
                                                }

                                                forkJoin(...assignEntitiesToGroup).subscribe(resp => {
                                                  this.result = "Migration has been completed successfully";
                                                  this.progress = 100;
                                                  this.ctx.detectChanges();
                                                  setTimeout(() => {
                                                    this.isLoading = false;
                                                    this.ctx.detectChanges();
                                                  }, 3000);

                                                }, error => {
                                                  this.requestError("Migration error, check details in browser console", error);
                                                })
                                              }, error => {
                                                this.requestError("Migration error, check details in browser console", error);
                                              })
                                            }, error => {
                                              this.requestError("Migration error, check details in browser console", error);
                                            })
                                        }, error => {
                                          this.requestError("Migration error, check details in browser console", error);
                                        })
                                      }, error => {
                                        this.requestError("Migration error, check details in browser console", error);
                                      })
                                    }, error => {
                                      this.requestError("Migration error, check details in browser console", error);
                                    })
                                  }, error => {
                                    this.requestError("Migration error, check details in browser console", error);
                                  })
                                }, error => {
                                  this.requestError("Migration error, check details in browser console", error);
                                })
                              }, error => {
                                this.requestError("Migration error, check details in browser console", error);
                              })
                            }, error => {
                              this.requestError("Migration error, check details in browser console", error);
                            })
                        }, error => {
                          this.requestError("Migration error, check details in browser console", error);
                        })
                    }, error => {
                      this.requestError("Migration error, check details in browser console", error);
                    })
                  }, error => {
                    this.requestError("Migration error, check details in browser console", error);
                  });
                }, error => {
                  this.requestError("Migration error, check details in browser console", error);
                })
              }, error => {
                this.requestError("Migration error, check details in browser console", error);
              })
            }, error => {
              this.requestError("Migration error, check details in browser console", error);
            })
        }, error => {
          this.requestError("Migration error, check details in browser console", error);
        })
      }, error => {
        this.requestError("Migration error, check details in browser console", error);
      })
    }, error => {
      this.requestError("Migration error, check details in browser console", error);
    });
  }

  requestError = (info: string, error: any) => {
    console.error(info, error);
    this.ctx.showErrorToast(info);
    this.isLoading = false;
    this.ctx.detectChanges();
  }

  getRuleChainMetadata(ruleChainId
                         :
                         string
  ):
    Observable<RuleChainMetaData> {
    return this.ctx.http.get<RuleChainMetaData>(`/api/ruleChain/${ruleChainId}/metadata`, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + localStorage.getItem("jwt_token"),
        'Content-Type': 'application/json'
      }
    });
  }

  createRequest(name)
    :
    Observable<RuleChain> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/ruleChain`, {name: name},
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  metadataRequest(metadataBody)
    :
    Observable<RuleChainMetaData> {
    return this.ctx.http.post<RuleChainMetaData>(`${this.targetUrl}api/ruleChain/metadata`, metadataBody,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  getToken(username
             :
             string, password
             :
             string
  ):
    Observable<{ refreshToken: string, token: string }> {
    return this.ctx.http.post<{ refreshToken: string, token: string }>(`${this.targetUrl}api/auth/login`, {
      password,
      username
    });
  }

  setRootRuleChain(ruleChainId)
    :
    Observable<RuleChain> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/ruleChain/${ruleChainId}/root`, null,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  createAsset(asset: { name: string, type: string, label: string, additionalInfo: any }): Observable<any> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/asset`, asset,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  createDevice(device: { name: string, type?: string, label: string, additionalInfo: any, deviceProfileId?: { entityType: string, id: string } }): Observable<any> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/device`, device,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  createDashboard(dashboard)
    :
    Observable<any> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/dashboard`, dashboard,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  createEntityGroup(entityGroup
                      :
                      {
                        type: EntityType, name
                          :
                          string
                      }
  ):
    Observable<any> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/entityGroup`, entityGroup,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  addEntitiesToEntityGroup(entityGroupId
                             :
                             string, entityIds
                             :
                             string[],
  ):
    Observable<any> {
    return this.ctx.http.post(`${this.targetUrl}api/entityGroup/${entityGroupId}/addEntities`, entityIds, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
        'Content-Type': 'application/json'
      }
    });
  }

  saveAttributes(entityId
                   :
                   EntityId, attributes
                   :
                   Array<AttributeData>
  ):
    Observable<any> {
    const attributesData
      :
      {
        [key
          :
          string
          ]:
          any
      }
      = {};
    attributes.forEach(attribute => {
      attributesData[attribute.key] = attribute.value;
    })
    return this.ctx.http.post(`${this.targetUrl}api/plugins/telemetry/${entityId.entityType}/${entityId.id}/SERVER_SCOPE`, attributesData, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
        'Content-Type': 'application/json'
      }
    })
  }

  getConvertors() {
    return this.ctx.http.get("/api/converters?pageSize=1000&page=0&sortProperty=createdTime&sortOrder=DESC");
  }

  createConverters(converter): Observable<any> {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/converter`, converter,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }


  getIntegrations() {
    return this.ctx.http.get("/api/integrations?pageSize=1000&page=0&sortProperty=createdTime&sortOrder=DESC");
  }

  createIntegrations(integration) {
    return this.ctx.http.post<RuleChain>(`${this.targetUrl}api/integration`, integration,
      {
        headers: {
          [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
          'Content-Type': 'application/json'
        }
      })
  }

  guid(): string {
    function s4(): string {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
  }

  generateSecret(length?: number): string {
    if (length === undefined || length == null) {
      length = 1;
    }
    const l = length > 10 ? 10 : length;
    const str = Math.random().toString(36).substr(2, l);
    if (str.length >= length) {
      return str;
    }
    return str.concat(this.generateSecret(length - str.length));
  }

  getDeviceProfilesInfo(): Observable<any> {
    return this.ctx.http.get(`/api/deviceProfileInfos?pageSize=1000&page=0&sortProperty=name&sortOrder=ASC`, {
      headers: {
        [this.AUTH_HEADER_NAME]: '' + this.AUTH_SCHEME + this.authToken,
        'Content-Type': 'application/json'
      }
    });
  }


  ngOnInit() {
  }

  ngAfterViewInit() {
  }
}
