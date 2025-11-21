import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Users, FileText, TrendingUp, Target, Percent, CheckCircle2 } from 'lucide-react';
import type { DashboardResponseDealInfo } from '@/src/frontend/lib/api-client';
import type { DealWithExtendedFields, PeriodWithKPI } from '@/src/frontend/lib/mock-data';
import { mockDeals } from '@/src/frontend/lib/mock-data';

interface DealInfoSectionProps {
  dealInfo: DashboardResponseDealInfo & {
    buyerName?: string;
    sellerName?: string;
    earnoutPeriodYears?: number;
    kpiTargetAmount?: number;
    contingentConsiderationAmount?: number;
    headquarterExpenseAllocationPercentage?: number;
  };
}

export function DealInfoSection({ dealInfo }: DealInfoSectionProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return 'Not set';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: dealInfo.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Get KPI summary data from mock deals
  const deal = mockDeals.find(d => d.dealId === dealInfo.dealId);
  const periods = deal?.periods as PeriodWithKPI[] | undefined;
  const lastPeriod = periods?.[periods.length - 1];
  const cumulativeNetProfit = lastPeriod?.cumulativeNetProfit;
  const kpiTarget = deal?.kpiTargetAmount || 900000;
  const kpiAchieved = lastPeriod?.kpiAchieved || false;
  const kpiProgress = lastPeriod?.kpiProgress || 0;
  const settlement = lastPeriod?.settlement;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deal Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={getStatusColor(dealInfo.status)} className="text-sm">
            {getStatusLabel(dealInfo.status)}
          </Badge>
        </CardContent>
      </Card>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Agreement Date</div>
              <div className="text-sm text-muted-foreground">
                {formatDate(dealInfo.agreementDate)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Currency</div>
              <div className="text-sm text-muted-foreground">{dealInfo.currency}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">
              Buyer (Acquirer)
              {dealInfo.buyerName && (
                <span className="ml-2 text-muted-foreground font-normal">
                  {dealInfo.buyerName}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {formatAddress(dealInfo.roles.buyer)}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">
              Seller
              {dealInfo.sellerName && (
                <span className="ml-2 text-muted-foreground font-normal">
                  {dealInfo.sellerName}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {formatAddress(dealInfo.roles.seller)}
            </div>
          </div>

          {dealInfo.roles.auditor && (
            <div>
              <div className="text-sm font-medium mb-1">Auditor</div>
              <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {formatAddress(dealInfo.roles.auditor)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Parameters Card */}
      {(dealInfo.earnoutPeriodYears || dealInfo.kpiTargetAmount || dealInfo.contingentConsiderationAmount) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dealInfo.earnoutPeriodYears && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Earn-out Period</div>
                  <div className="text-sm text-muted-foreground">
                    {dealInfo.earnoutPeriodYears} {dealInfo.earnoutPeriodYears === 1 ? 'year' : 'years'}
                  </div>
                </div>
              </div>
            )}

            {dealInfo.kpiTargetAmount && (
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">KPI Target Amount</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(dealInfo.kpiTargetAmount)} Net Profit
                  </div>
                </div>
              </div>
            )}

            {dealInfo.contingentConsiderationAmount && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Contingent Consideration</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(dealInfo.contingentConsiderationAmount)}
                  </div>
                </div>
              </div>
            )}

            {dealInfo.headquarterExpenseAllocationPercentage !== undefined && (
              <div className="flex items-start gap-3">
                <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Overhead Allocation</div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercentage(dealInfo.headquarterExpenseAllocationPercentage)} of corporate pool
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Summary Card */}
      {cumulativeNetProfit !== undefined && (
        <Card className={kpiAchieved ? 'border-green-500 border-2' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">KPI Summary</CardTitle>
              {kpiAchieved && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Achieved
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cumulative Net Profit */}
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Total Cumulative Net Profit</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(cumulativeNetProfit)}
                </div>
              </div>
            </div>

            {/* KPI Target */}
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">KPI Target</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(kpiTarget)}
                </div>
              </div>
            </div>

            {/* Achievement Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Achievement Rate</div>
                <span className={`text-lg font-bold ${kpiAchieved ? 'text-green-600' : ''}`}>
                  {(kpiProgress * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    kpiAchieved ? 'bg-green-600' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(kpiProgress * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Settlement Info (if achieved) */}
            {kpiAchieved && settlement && (
              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Settlement Completed</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount Paid to Seller</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(settlement.payoutAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Settlement Date</span>
                  <span>{formatDate(settlement.settledAt)}</span>
                </div>
                {settlement.txHash && (
                  <div className="text-xs text-muted-foreground font-mono pt-2 border-t">
                    Transaction Hash: {settlement.txHash}
                  </div>
                )}
              </div>
            )}

            {/* Status Message */}
            {!kpiAchieved && (
              <div className="text-sm text-muted-foreground italic">
                KPI target not yet achieved. Continue monitoring period performance.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
