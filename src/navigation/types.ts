import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** The chip the Outlets tab opens on (Today's suggestions card opens 'sugg'). */
export type OutletsFilter = 'all' | 'customer' | 'prospect' | 'sugg';

/** Field rep tabs: places, not actions (rule 1). Record sits beside the bar. */
export type RepTabParamList = {
  Today: undefined;
  Outlets: { filter?: OutletsFilter } | undefined;
  Tasks: undefined;
  Forms: undefined;
};

/** Manager (and Admin) tabs. */
/** The chip the manager's Tasks tab opens on. */
export type MgrFocus = 'urgent' | 'overdue' | 'due_today' | 'to_check';

export type ManagerTabParamList = {
  Team: undefined;
  MgrTasks: { focus?: MgrFocus } | undefined;
  Review: { show?: 'forms' | 'visits' } | undefined;
  Outlets: { filter?: OutletsFilter } | undefined;
  Forms: undefined;
};

/**
 * Everything above the tabs. Detail screens live here, so the tab bar is
 * hidden on them and their main actions sit at the bottom (rule 5).
 */
export type RootStackParamList = {
  // Signed out
  SignIn: undefined;
  ForgotPassword: { email?: string } | undefined;
  // First run
  Welcome: undefined;
  // Signed in
  RepHome: NavigatorScreenParams<RepTabParamList> | undefined;
  ManagerHome: NavigatorScreenParams<ManagerTabParamList> | undefined;
  Me: undefined;
  MyVisits: undefined;
  MyOrders: undefined;
  DeleteAccount: undefined;
  Alerts: undefined;

  // Tasks
  Task: { id: number; title?: string };
  TaskMessages: { id: number; title?: string };
  ParkedTasks: undefined;
  TaskSearch: undefined;
  CheckTask: { id: number; title?: string };
  AddTask: { outletId?: number; outletName?: string; reportId?: number; title?: string; assigneeId?: number } | undefined;

  // Outlets
  Outlet: { id: number; name?: string };
  OutletSuggested: { id: number; name?: string };
  OutletVisits: { id: number; name?: string };
  OutletOrders: { id: number; name?: string };
  OutletTasks: { id: number; name?: string };
  OutletDetails: { id: number; name?: string };
  OutletDocuments: { id: number; name?: string };
  OutletForm: { id?: number };
  OutletMap: undefined;
  VisitBrief: { id: number; name?: string };
  AskRonda: { id: number; name?: string };
  PickOutlet: { purpose: 'visit' | 'order' | 'task' };

  // Recording
  LogVisit: { outletId?: number; taskId?: number };
  RecordOrder: { outletId?: number; productIds?: number[]; fromVisit?: boolean };
  OrderSent: { outletId: number; outletName: string; orderNo: string | null; orderedAt: string; total: number; lines: number };
  VisitReport: { id: number; ids?: number[] };

  // Forms
  StartForm: undefined;
  /**
   * new: start it. again: a copy of an earlier entry (entryId). edit: change
   * answers no one has acted on (entryId). stage: fill in your part (entryId).
   */
  FillForm: {
    formId: number;
    mode?: 'new' | 'again' | 'edit' | 'stage';
    entryId?: number;
    /** A follow-up on an earlier record. */
    parent?: { id: number; reference: string; title: string };
  };
  FormSent: { recordId: number | null; title: string; formName: string; formId: number; kind: 'sent' | 'changed' | 'stage'; next?: string | null };
  Records: undefined;
  /** A record and its entry are the same thing on the server. */
  Record: { id: number; title?: string };

  // Manager
  Person: { userId: number; name?: string };
  TeamActivity: undefined;
  RoundUp: undefined;
};

export type RootScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

export type RepTabScreenProps<K extends keyof RepTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<RepTabParamList, K>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ManagerTabScreenProps<K extends keyof ManagerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ManagerTabParamList, K>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
