/**
 * React Query hooks for Dashboard
 * Fetches dashboard data from mock data for development
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import type { DashboardResponse, Period } from '@/src/frontend/lib/api-client';
import { getDashboardByDealId } from '@/src/frontend/lib/mock-data';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (dealId: string) => [...dashboardKeys.all, dealId] as const,
};

/**
 * Hook to fetch dashboard data for a specific deal
 * Uses mock data for development
 */
export function useDashboard(dealId: string) {
  const currentAccount = useCurrentAccount();

  return useQuery<DashboardResponse>({
    queryKey: dashboardKeys.detail(dealId),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Return mock data
      return getDashboardByDealId(dealId);
    },
    enabled: !!dealId && !!currentAccount?.address,
  });
}

/**
 * Hook to get current period information
 */
export function useCurrentPeriod(dealId: string) {
  const { data: dashboard } = useDashboard(dealId);

  if (!dashboard) {
    return null;
  }

  // Find the first period that is not settled
  const currentPeriod = dashboard.periodsSummary?.find(
    (period) => period.settlementStatus !== 'settled'
  );

  return currentPeriod || dashboard.periodsSummary[dashboard.periodsSummary.length - 1];
}

/**
 * Hook to get pending actions for the current user
 */
export function usePendingActions(dealId: string) {
  const { data: dashboard } = useDashboard(dealId);

  if (!dashboard) {
    return [];
  }

  // Extract all next actions from periods
  const pendingActions = (dashboard.periodsSummary || [])
    .filter((period) => period.nextAction)
    .map((period) => ({
      periodId: period.periodId,
      periodName: period.name,
      action: period.nextAction!.action,
      actor: period.nextAction!.actor,
      deadline: period.nextAction!.deadline,
    }))
    .filter((action) => action.actor === dashboard.dealInfo.userRole);

  return pendingActions;
}
