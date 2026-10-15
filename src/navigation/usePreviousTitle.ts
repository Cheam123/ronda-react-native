import { useNavigationState } from '@react-navigation/native';

/** Names the back link after the screen it returns to ("‹ Today", "‹ Daily Grind SS2"). */
const TITLES: Record<string, string> = {
  Today: 'Today',
  Outlets: 'Outlets',
  Tasks: 'Tasks',
  MgrTasks: 'Tasks',
  Forms: 'Forms',
  Team: 'Team',
  Review: 'Review',
  Task: 'Task',
  TaskSearch: 'Search',
  ParkedTasks: 'Paused',
  CheckTask: 'Task',
  Me: 'Me',
  MyVisits: 'My visits',
  MyOrders: 'My orders',
  Alerts: 'Alerts',
  OutletVisits: 'Visits',
  OutletOrders: 'Orders',
  OutletTasks: 'Tasks',
  OutletSuggested: 'Suggested',
  Records: 'My records',
  Record: 'Record',
  Person: 'Person',
  TeamActivity: 'Activity',
};

type AnyRoute = { name: string; params?: Record<string, unknown>; state?: { index?: number; routes: AnyRoute[] } };

export function usePreviousTitle(): string | null {
  return useNavigationState((state) => {
    if (!state || state.index < 1) return null;
    const prev = state.routes[state.index - 1] as unknown as AnyRoute;
    // The tab navigator: name the tab that was showing.
    if (prev.name === 'RepHome' || prev.name === 'ManagerHome') {
      const tabs = prev.state;
      const tab = tabs?.routes[tabs.index ?? 0]?.name ?? (prev.name === 'RepHome' ? 'Today' : 'Team');
      return TITLES[tab] ?? null;
    }
    const named = prev.params?.name ?? prev.params?.title;
    if (typeof named === 'string' && named && ['Outlet', 'Person'].includes(prev.name)) return named;
    return TITLES[prev.name] ?? null;
  });
}

/**
 * A button that leaves the screen, named after where it goes: "Back to tasks",
 * "Back to today", "Back to the outlet". Plain "Back" when that is unclear.
 */
export function useBackLabel(): string {
  const title = usePreviousTitle();
  const prevName = useNavigationState((state) => (state && state.index > 0 ? state.routes[state.index - 1].name : null));
  if (prevName === 'Outlet') return 'Back to the outlet';
  if (!title || prevName === 'Person') return 'Back';
  return `Back to ${title.toLowerCase()}`;
}
