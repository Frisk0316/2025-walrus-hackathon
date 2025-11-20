/**
 * React Query hooks for Deals
 * Uses mock data for now, will be replaced with real API calls later
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DealListResponse,
  DealSummary,
  Deal,
  CreateDealRequest,
  CreateDealResponse,
} from '@/src/frontend/lib/api-client';
import { mockDealSummaries, mockDeals, MOCK_ADDRESSES } from '@/src/frontend/lib/mock-data';

// Query keys
export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (filters: string) => [...dealKeys.lists(), { filters }] as const,
  details: () => [...dealKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealKeys.details(), id] as const,
};

/**
 * Hook to fetch all deals for the current user
 */
export function useDeals(role?: 'buyer' | 'seller' | 'auditor') {
  return useQuery<DealListResponse>({
    queryKey: dealKeys.list(role || 'all'),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Return mock data
      const filteredDeals = role
        ? mockDealSummaries.filter((deal) => deal.userRole === role)
        : mockDealSummaries;

      return {
        items: filteredDeals,
        total: filteredDeals.length,
        hasMore: false,
        limit: 20,
        offset: 0,
      };
    },
  });
}

/**
 * Hook to fetch a single deal by ID
 */
export function useDeal(dealId: string) {
  return useQuery<Deal | undefined>({
    queryKey: dealKeys.detail(dealId),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Find deal in mock data
      return mockDeals.find((deal) => deal.dealId === dealId);
    },
    enabled: !!dealId,
  });
}

/**
 * Hook to create a new deal
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation<CreateDealResponse, Error, CreateDealRequest>({
    mutationFn: async (request: CreateDealRequest) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create mock deal
      const newDeal: Deal = {
        dealId: `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`,
        name: request.name,
        closingDate: request.closingDate as any,
        currency: request.currency,
        buyer: request.buyerAddress,
        seller: request.sellerAddress,
        auditor: request.auditorAddress,
        status: 'draft',
        periods: [],
        metadata: request.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to mock data (in real app, this would be server-side)
      mockDeals.push(newDeal);

      const dealSummary: DealSummary = {
        dealId: newDeal.dealId,
        name: newDeal.name,
        closingDate: newDeal.closingDate as any,
        currency: newDeal.currency,
        status: newDeal.status,
        userRole: 'buyer',
        periodCount: 0,
        settledPeriods: 0,
        lastActivity: newDeal.createdAt as any,
      };

      mockDealSummaries.push(dealSummary);

      return {
        deal: newDeal,
        transaction: {
          txBytes: 'mock_tx_bytes_base64_encoded',
          description: `Create earn-out deal: ${newDeal.name}`,
          estimatedGas: 1000000,
        },
      };
    },
    onSuccess: () => {
      // Invalidate and refetch deals list
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
    },
  });
}

/**
 * Hook to get deal summary statistics
 */
export function useDealStats(role?: 'buyer' | 'seller' | 'auditor') {
  const { data } = useDeals(role);

  if (!data) {
    return {
      totalDeals: 0,
      activeDeals: 0,
      completedDeals: 0,
      draftDeals: 0,
    };
  }

  return {
    totalDeals: data.total,
    activeDeals: data.items.filter((d) => d.status === 'active').length,
    completedDeals: data.items.filter((d) => d.status === 'completed').length,
    draftDeals: data.items.filter((d) => d.status === 'draft').length,
  };
}
