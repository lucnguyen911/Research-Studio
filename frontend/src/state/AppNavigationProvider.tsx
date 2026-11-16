import React, { useSyncExternalStore } from 'react';
import {
  AppNavigationContext,
  getNavSnapshot,
  goBack,
  goForward,
  navigateTo,
  reconcileValidProjects,
  subscribeNav,
  switchActiveProjectAtomic,
  updateCurrentViewState,
  type AppNavigationContextValue,
} from './navigationStore';

export const AppNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useSyncExternalStore(subscribeNav, getNavSnapshot, getNavSnapshot);
  const currentEntry = state.entries[state.index];

  const value: AppNavigationContextValue = {
    currentEntry,
    canGoBack: state.index > 0,
    canGoForward: state.index < state.entries.length - 1,
    historyPosition: `${state.index + 1}/${state.entries.length}`,
    navigate: navigateTo,
    goBack,
    goForward,
    switchProject: switchActiveProjectAtomic,
    updateViewState: updateCurrentViewState,
    reconcileProjects: reconcileValidProjects,
  };

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
};
