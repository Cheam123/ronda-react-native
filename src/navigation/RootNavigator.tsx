import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { fetchHome, homeKey } from '../api/home';
import { fetchTeam, teamKeys } from '../api/team';
import { useAuth } from '../auth/AuthProvider';
import { AlertsScreen } from '../features/alerts/AlertsScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { WelcomeScreen } from '../features/auth/WelcomeScreen';
import { FillFormScreen } from '../features/forms/FillFormScreen';
import { FormSentScreen } from '../features/forms/FormSentScreen';
import { FormsScreen } from '../features/forms/FormsScreen';
import { RecordScreen } from '../features/forms/RecordScreen';
import { RecordsScreen } from '../features/forms/RecordsScreen';
import { StartFormScreen } from '../features/forms/StartFormScreen';
import { DeleteAccountScreen } from '../features/me/DeleteAccountScreen';
import { MeScreen } from '../features/me/MeScreen';
import { MyOrdersScreen } from '../features/me/MyOrdersScreen';
import { MyVisitsScreen } from '../features/me/MyVisitsScreen';
import { AskRondaScreen } from '../features/outlets/AskRondaScreen';
import { OutletDetailsScreen } from '../features/outlets/OutletDetailsScreen';
import { OutletDocumentsScreen } from '../features/outlets/OutletDocumentsScreen';
import { OutletFormScreen } from '../features/outlets/OutletFormScreen';
import { OutletOrdersScreen } from '../features/outlets/OutletOrdersScreen';
import { OutletScreen } from '../features/outlets/OutletScreen';
import { OutletsScreen } from '../features/outlets/OutletsScreen';
import { OutletSuggestedScreen } from '../features/outlets/OutletSuggestedScreen';
import { OutletTasksScreen } from '../features/outlets/OutletTasksScreen';
import { OutletVisitsScreen } from '../features/outlets/OutletVisitsScreen';
import { PickOutletScreen } from '../features/outlets/PickOutletScreen';
import { VisitBriefScreen } from '../features/outlets/VisitBriefScreen';
import { LogVisitScreen } from '../features/record/LogVisitScreen';
import { OrderSentScreen } from '../features/record/OrderSentScreen';
import { RecordOrderScreen } from '../features/record/RecordOrderScreen';
import { AddTaskScreen } from '../features/team/AddTaskScreen';
import { CheckTaskScreen } from '../features/team/CheckTaskScreen';
import { MgrTasksScreen } from '../features/team/MgrTasksScreen';
import { PersonScreen } from '../features/team/PersonScreen';
import { ReviewScreen } from '../features/team/ReviewScreen';
import { RoundUpScreen } from '../features/team/RoundUpScreen';
import { TeamActivityScreen } from '../features/team/TeamActivityScreen';
import { TeamScreen } from '../features/team/TeamScreen';
import { VisitReportScreen } from '../features/visits/VisitReportScreen';
import { ParkedTasksScreen } from '../features/tasks/ParkedTasksScreen';
import { TaskMessagesScreen } from '../features/tasks/TaskMessagesScreen';
import { TaskScreen } from '../features/tasks/TaskScreen';
import { TaskSearchScreen } from '../features/tasks/TaskSearchScreen';
import { TasksScreen } from '../features/tasks/TasksScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { useColors } from '../theme/ThemeProvider';
import { TabBar } from './TabBar';
import type { ManagerTabParamList, RepTabParamList, RootStackParamList } from './types';
import { UpdateGate } from './UpdateGate';

const Stack = createNativeStackNavigator<RootStackParamList>();
const RepTabs = createBottomTabNavigator<RepTabParamList>();
const ManagerTabs = createBottomTabNavigator<ManagerTabParamList>();


/** Overdue tasks on the Tasks tab, form steps on the Forms tab. */
function useBadges() {
  const home = useQuery({ queryKey: homeKey, queryFn: fetchHome });
  const overdue = home.data?.today.counts.overdue ?? 0;
  const forms = home.data?.today.counts.form_steps ?? 0;
  return {
    tasks: overdue > 0 ? { tabBarBadge: overdue, tabBarAccessibilityLabel: `Tasks, ${overdue} overdue` } : { tabBarAccessibilityLabel: 'Tasks' },
    forms: forms > 0 ? { tabBarBadge: forms, tabBarAccessibilityLabel: `Forms, ${forms} waiting` } : { tabBarAccessibilityLabel: 'Forms' },
  };
}

function RepHome() {
  const badges = useBadges();
  return (
    <RepTabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} withRecord />}>
      <RepTabs.Screen name="Today" component={TodayScreen} />
      <RepTabs.Screen name="Outlets" component={OutletsScreen} />
      <RepTabs.Screen name="Tasks" component={TasksScreen} options={badges.tasks} />
      <RepTabs.Screen name="Forms" component={FormsScreen} options={badges.forms} />
    </RepTabs.Navigator>
  );
}

/** Forms and visit reports waiting in Review. */
function useReviewBadge() {
  const team = useQuery({ queryKey: teamKeys.team, queryFn: fetchTeam });
  const n = (team.data?.review.forms ?? 0) + (team.data?.review.visits ?? 0);
  return n > 0 ? { tabBarBadge: n, tabBarAccessibilityLabel: `Review, ${n} waiting` } : { tabBarAccessibilityLabel: 'Review' };
}

function ManagerHome() {
  const badges = useBadges();
  const review = useReviewBadge();
  return (
    <ManagerTabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} withRecord={false} />}>
      <ManagerTabs.Screen name="Team" component={TeamScreen} />
      <ManagerTabs.Screen name="MgrTasks" component={MgrTasksScreen} options={{ title: 'Tasks' }} />
      <ManagerTabs.Screen name="Review" component={ReviewScreen} options={review} />
      <ManagerTabs.Screen name="Outlets" component={OutletsScreen} />
      <ManagerTabs.Screen name="Forms" component={FormsScreen} options={badges.forms} />
    </ManagerTabs.Navigator>
  );
}

export function RootNavigator() {
  const colors = useColors();
  const { status, role, needsLocationIntro } = useAuth();

  const screenOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: colors.ground },
    animation: 'default' as const,
  };

  if (status === 'signedOut') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    );
  }

  if (needsLocationIntro) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <UpdateGate>
      <Stack.Navigator screenOptions={screenOptions}>
        {role === 'rep' ? (
          <Stack.Screen name="RepHome" component={RepHome} />
        ) : (
          <Stack.Screen name="ManagerHome" component={ManagerHome} />
        )}
        <Stack.Screen name="Me" component={MeScreen} />
        <Stack.Screen name="MyVisits" component={MyVisitsScreen} />
        <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Alerts" component={AlertsScreen} />

        <Stack.Screen name="Task" component={TaskScreen} />
        <Stack.Screen name="TaskMessages" component={TaskMessagesScreen} />
        <Stack.Screen name="ParkedTasks" component={ParkedTasksScreen} />
        <Stack.Screen name="TaskSearch" component={TaskSearchScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="CheckTask" component={CheckTaskScreen} />

        <Stack.Screen name="Person" component={PersonScreen} />
        <Stack.Screen name="TeamActivity" component={TeamActivityScreen} />
        <Stack.Screen name="RoundUp" component={RoundUpScreen} />

        <Stack.Screen name="Outlet" component={OutletScreen} />
        <Stack.Screen name="OutletSuggested" component={OutletSuggestedScreen} />
        <Stack.Screen name="OutletVisits" component={OutletVisitsScreen} />
        <Stack.Screen name="OutletOrders" component={OutletOrdersScreen} />
        <Stack.Screen name="OutletTasks" component={OutletTasksScreen} />
        <Stack.Screen name="OutletDetails" component={OutletDetailsScreen} />
        <Stack.Screen name="OutletDocuments" component={OutletDocumentsScreen} />
        <Stack.Screen name="VisitBrief" component={VisitBriefScreen} />
        <Stack.Screen name="VisitReport" component={VisitReportScreen} />

        <Stack.Screen name="Records" component={RecordsScreen} />
        <Stack.Screen name="Record" component={RecordScreen} />

        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AskRonda" component={AskRondaScreen} />
          <Stack.Screen name="OutletForm" component={OutletFormScreen} />
          <Stack.Screen name="LogVisit" component={LogVisitScreen} />
          <Stack.Screen name="RecordOrder" component={RecordOrderScreen} />
          <Stack.Screen name="PickOutlet" component={PickOutletScreen} />
          <Stack.Screen name="StartForm" component={StartFormScreen} />
          <Stack.Screen name="AddTask" component={AddTaskScreen} />
          <Stack.Screen name="FillForm" component={FillFormScreen} options={{ gestureEnabled: false }} />
        </Stack.Group>
        <Stack.Screen name="OrderSent" component={OrderSentScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="FormSent" component={FormSentScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Navigator>
    </UpdateGate>
  );
}
