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
  selector: 'tb-migration',
  templateUrl: './tb-migration.component.html',
  styleUrls: ['./tb-migration.component.scss']
})


export class TbMigrationComponent implements AfterViewInit, OnInit {

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
    targetUsername: 'migration@test.com',
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

      // Rule chain migration
      getRuleChains.subscribe(resp => {
        this.result = "Migrating Rule Chains";
        this.ctx.detectChanges();
        const ruleChainMap: idsMap = {};
        resp.data.forEach(rc => {
          ruleChainMap[rc.name] = {
            oldId: rc.id.id,
            newId: "",
            root: rc.root
          }
        })
        const targetRuleChain = resp.data.find(ruleChain => ruleChain.name === "Generate Report");
        const ruleChainConfigRequestArray = [];
        resp.data.forEach(ruleChain => ruleChainConfigRequestArray.push(this.getRuleChainMetadata(ruleChain.id.id)))
        forkJoin(ruleChainConfigRequestArray).subscribe(config => {
          const createNewRuleChains = forkJoin(resp.data.map(ruleChain => this.createRequest(ruleChain.name)));
          createNewRuleChains.subscribe(newRc => {
            newRc.forEach(rc => {
              ruleChainMap[rc.name].newId = rc.id.id;
            })
            const updatedMetadata = config.map((cfg: RuleChainMetaData) => {
              const newRc = Object.values(ruleChainMap).find(ids => {
                return ids.oldId === cfg.ruleChainId.id;
              })
              if (newRc && newRc.newId) {
                cfg.ruleChainId.id = newRc.newId;
                cfg.nodes.forEach((node, index, nodes) => {
                  delete nodes[index].ruleChainId;
                  delete nodes[index].id;
                  if (node.type.includes("TbRuleChainInputNode")) {
                    nodes[index].configuration.ruleChainId = Object.values(ruleChainMap).find(ids => {
                      return ids.oldId === node.configuration.ruleChainId;
                    }).newId;
                  }
                })
              }
              return cfg;
            });
            const updateMetadata = forkJoin(updatedMetadata.map(cfg => this.metadataRequest(cfg)));
            updateMetadata.subscribe(meta => {
              const rootRCId = Object.values(ruleChainMap).find(rc => rc.root).newId;
              this.setRootRuleChain(rootRCId).subscribe(root => {

                //Assets migration
                this.progress = 20;
                this.result = "Migrating Assets";
                this.ctx.detectChanges();
                this.ctx.entityGroupService.getEntityGroups(EntityType.ASSET).subscribe(groups => {
                  const allGroup = groups.find(group => group.name === "All");
                  this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
                    const createEntitiesRequests = [];
                    const createGroupsRequests = [];
                    groups.forEach(group => {
                      if (group.name !== "All") {
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
                          if (group.name !== "All") {
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
                                if (info.name === "Configuration") {
                                  // @ts-ignore
                                  technicalAssets.push(this.ctx.attributeService.getEntityAttributes(gInfo.id, "SERVER_SCOPE")
                                    .pipe(map(res => { // @ts-ignore
                                      if (res) res.push(created.find(newEntities => newEntities.name === gInfo.name).id);
                                      return res
                                    })));
                                }
                                groupIds.push(created.find(newEntities => newEntities.name === gInfo.name).id.id)
                              })
                              assignEntitiesToGroup.push(this.addEntitiesToEntityGroup(created.find(group => group.name === info.name).id.id, groupIds))
                            }
                          })
                          const technicalAttributes = [];

                          forkJoin(...assignEntitiesToGroup, ...technicalAttributes, ...technicalAssets).subscribe(assigned => {
                            const saveAttr = [];
                            assigned.forEach((attrResp, index) => {
                              if (attrResp && attrResp.length > 1) {
                                const config = attrResp.find(el => el.key === 'config');
                                if (config) {
                                  const value = JSON.parse(config.value);
                                  value.configArray = value.configArray.map(cfg => {
                                    cfg.destination = ""
                                    return cfg;
                                  })
                                  attrResp[attrResp.findIndex(el => el.key === 'config')].value = JSON.stringify(value);
                                }
                                saveAttr.push(this.saveAttributes(attrResp[attrResp.length - 1] as EntityId, attrResp.filter(el => !el.id)))

                              }
                            })
                            forkJoin(...saveAttr).subscribe(finalAssets => {

                              //Dashboard migration
                              this.progress = 40;
                              this.result = "Migrating Dashboards";
                              this.ctx.detectChanges();
                              this.ctx.entityGroupService.getEntityGroups(EntityType.DASHBOARD).subscribe(groups => {
                                const allGroup = groups.find(group => group.name === "All");
                                this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
                                  const createEntitiesRequests = [];
                                  const createGroupsRequests = [];
                                  groups.forEach(group => {
                                    if (group.name !== "All") {
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
                                        createEntitiesRequests.push(this.createDashboard(cfg))
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
                                                this.progress = 60;
                                                this.result = "Migrating Devices";
                                                this.ctx.detectChanges();
                                                this.ctx.entityGroupService.getEntityGroups(EntityType.DEVICE).subscribe(groups => {
                                                  const allGroup = groups.find(group => group.name === "All");
                                                  this.ctx.entityGroupService.getEntityGroupEntities(allGroup.id.id, this.ctx.pageLink(10000)).subscribe(allEntities => {
                                                    const createEntitiesRequests = [];
                                                    const createGroupsRequests = [];
                                                    groups.forEach(group => {
                                                      if (group.name !== "All") {
                                                        createGroupsRequests.push(this.createEntityGroup({
                                                          type: group.type,
                                                          name: group.name
                                                        }))
                                                      }
                                                    })
                                                    allEntities.data.forEach(device => {
                                                      // @ts-ignore
                                                      createEntitiesRequests.push(this.createDevice({
                                                        name: device.name,
                                                        // @ts-ignore
                                                        type: device.device_profile,
                                                        label: device.label || null,
                                                        additionalInfo: {
                                                          description: ""
                                                        }

                                                      }))
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
                                                          forkJoin(...assignEntitiesToGroup).subscribe(resp => {

                                                            //Convertors & Integrators migration
                                                            this.progress = 80;
                                                            this.result = "Migrating Convertors & Integrators";
                                                            this.ctx.detectChanges();
                                                            this.getConvertors().subscribe((convertors: { data: Array<any> }) => {
                                                              const convertorsCreation = [];
                                                              convertors.data.forEach(cfg => {
                                                                cfg.oldId = cfg.id;
                                                                delete cfg.id;
                                                                delete cfg.tenantId;
                                                                convertorsCreation.push(this.createConverters(cfg).pipe(map(res => { // @ts-ignore
                                                                  res.oldId = cfg.oldId;
                                                                  return res
                                                                })));
                                                              })
                                                              forkJoin(...convertorsCreation).subscribe(newConvertors => {
                                                                this.getIntegrations().subscribe((integrations: { data: Array<any> }) => {
                                                                  const integrationCreation = [];
                                                                  integrations.data.forEach(cfg => {
                                                                    delete cfg.id;
                                                                    delete cfg.tenantId;
                                                                    cfg.routingKey = this.guid();
                                                                    cfg.secret = this.generateSecret(20);
                                                                    if (cfg.defaultConverterId) {
                                                                      cfg.defaultConverterId.id = newConvertors.find(convert => convert.oldId.id === cfg.defaultConverterId.id).id.id;
                                                                    } else if (cfg.downlinkConverterId) {
                                                                      cfg.downlinkConverterId.id = newConvertors.find(convert => convert.oldId.id === cfg.downlinkConverterId.id).id.id;
                                                                    }
                                                                    integrationCreation.push(this.createIntegrations(cfg));
                                                                  })
                                                                  forkJoin(...integrationCreation).subscribe(res => {
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
      });
    }, error => {
      this.requestError("Authentication error please check incoming credentials", error);
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

  createDevice(device: { name: string, type: string, label: string, additionalInfo: any }): Observable<any> {
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


  ngOnInit() {
  }

  ngAfterViewInit() {
  }
}
