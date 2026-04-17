export type UiMode = 'dark' | 'light';

export type AppPage = 'overview' | 'live-map' | 'journey' | 'operations' | 'settings';

export type PageItem = {
  id: AppPage;
  label: string;
  description: string;
};

export const PAGE_ITEMS: PageItem[] = [
  { id: 'overview', label: 'Overview', description: 'Full operational snapshot' },
  { id: 'live-map', label: 'Live Map', description: 'Venue and density view' },
  { id: 'journey', label: 'Journey', description: 'Routing and queue planning' },
  { id: 'operations', label: 'Operations', description: 'Staff, alerts, and resilience' },
  { id: 'settings', label: 'Settings', description: 'Theme and data preferences' },
];

export const isAppPage = (value: string): value is AppPage =>
  PAGE_ITEMS.some((item) => item.id === value);

export const getPageFromHash = (hash: string): AppPage => {
  const normalized = hash.replace('#', '');
  return isAppPage(normalized) ? normalized : 'overview';
};

export const isMapPage = (page: AppPage) => page === 'overview' || page === 'live-map';
