///
/// Copyright © 2021 ThingsBoard, Inc.
///

import {createFeatureSelector, createSelector, select, Store} from '@ngrx/store';

import {take} from 'rxjs/operators';

export const selectAuthState = createFeatureSelector<any>(
  'auth'
);

export const selectAuthUser = createSelector(
  selectAuthState,
  (state: any) => state.authUser
);

export function getCurrentAuthUser(store: Store<any>): any {
  let authUser: any;
  store.pipe(select(selectAuthUser), take(1)).subscribe(
    val => authUser = val
  );
  return authUser;
}
