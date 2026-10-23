import type { CityDebugApi } from '../../apps/web/src/state/debug';

declare global {
  interface Window {
    __cityDebug?: CityDebugApi;
  }
}
