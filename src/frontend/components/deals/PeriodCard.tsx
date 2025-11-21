import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  TrendingUp,
  CheckCircle2,
  FileCheck,
  Target,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Percent,
} from 'lucide-react';
import Link from 'next/link';
import type { PeriodSummary } from '@/src/frontend/lib/api-client';
import type { PeriodWithKPI } from '@/src/frontend/lib/mock-data';
import { mockDeals } from '@/src/frontend/lib/mock-data';

interface PeriodCardProps {
  period: PeriodSummary;
  dealId: string;
  userRole: 'buyer' | 'seller' | 'auditor';
}

export function PeriodCard({ period, dealId, userRole }: PeriodCardProps) {
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  // Get KPI data from mock deals
  const deal = mockDeals.find(d => d.dealId === dealId);
  const periodWithKPI = deal?.periods?.find(p => p.periodId === period.periodId) as PeriodWithKPI | undefined;

  const kpiTarget = deal?.kpiTargetAmount || 900000;
  const isKpiAchieved = periodWithKPI?.kpiAchieved || false;
  const kpiProgress = periodWithKPI?.kpiProgress || 0;

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getActionButton = () => {
    const hasDocuments = period.dataUploadProgress && period.dataUploadProgress.blobCount > 0;
    const isSettled = period.settlementStatus === 'settled';

    if (userRole === 'buyer') {
      return (
        <Button asChild size="sm" variant={isSettled ? 'outline' : 'default'} className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {isSettled ? 'View Period Details' : 'Manage Documents'}
          </Link>
        </Button>
      );
    }

    if (userRole === 'seller') {
      return (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            View Period Details
          </Link>
        </Button>
      );
    }

    if (userRole === 'auditor') {
      return (
        <Button asChild size="sm" variant={hasDocuments ? 'default' : 'outline'} className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {hasDocuments ? 'Review Documents' : 'View Period Details'}
          </Link>
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className={isKpiAchieved ? 'border-green-500 border-2' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{period.name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                <Calendar className="mr-1 h-3 w-3" />
                {formatDate(period.dateRange.start)} - {formatDate(period.dateRange.end)}
              </Badge>
              {period.settlementStatus === 'settled' && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Settled
                </Badge>
              )}
              {isKpiAchieved && (
                <Badge variant="default" className="bg-green-600">
                  <Target className="mr-1 h-3 w-3" />
                  KPI Achieved
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Monthly Revenue */}
          {periodWithKPI?.monthlyRevenue && (
            <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">Monthly Revenue</span>
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(periodWithKPI.monthlyRevenue)}
                </span>
              </div>
            </div>
          )}

          {/* Monthly Expenses (Collapsible) */}
          {periodWithKPI?.monthlyExpenses && (
            <div className="border rounded-lg">
              <button
                onClick={() => setShowExpenseDetails(!showExpenseDetails)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium">Expense Breakdown</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(
                      periodWithKPI.monthlyExpenses.depreciation +
                      periodWithKPI.monthlyExpenses.payroll +
                      periodWithKPI.monthlyExpenses.overheadAllocation
                    )}
                  </span>
                  {showExpenseDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
              {showExpenseDetails && (
                <div className="px-4 pb-3 space-y-2 text-sm border-t">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Depreciation</span>
                    <span className="font-medium">
                      {formatCurrency(periodWithKPI.monthlyExpenses.depreciation)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Payroll</span>
                    <span className="font-medium">
                      {formatCurrency(periodWithKPI.monthlyExpenses.payroll)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">HQ Allocation</span>
                    <span className="font-medium">
                      {formatCurrency(periodWithKPI.monthlyExpenses.overheadAllocation)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Net Profit */}
          {periodWithKPI?.monthlyNetProfit !== undefined && (
            <div className="bg-green-50 dark:bg-green-950/20 px-4 py-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Monthly Net Profit</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(periodWithKPI.monthlyNetProfit)}
                </span>
              </div>
            </div>
          )}

          {/* Cumulative Net Profit */}
          {periodWithKPI?.cumulativeNetProfit !== undefined && (
            <div className="bg-purple-50 dark:bg-purple-950/20 px-4 py-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium">Cumulative Net Profit</span>
                </div>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(periodWithKPI.cumulativeNetProfit)}
                </span>
              </div>
            </div>
          )}

          {/* KPI Progress Bar */}
          {periodWithKPI?.kpiProgress !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">KPI Progress</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${isKpiAchieved ? 'text-green-600' : ''}`}>
                    {(kpiProgress * 100).toFixed(1)}%
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Target: {formatCurrency(kpiTarget)}
                  </div>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    isKpiAchieved ? 'bg-green-600' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(kpiProgress * 100, 100)}%`,
                  }}
                />
              </div>
              {isKpiAchieved && (
                <div className="flex items-center gap-1 mt-2 text-xs font-medium text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Target Achieved!
                </div>
              )}
            </div>
          )}

          {/* Settlement Information (for achieved KPI) */}
          {isKpiAchieved && periodWithKPI?.settlement && (
            <div className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                <span>Settlement Completed</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payout Amount</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(periodWithKPI.settlement.payoutAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Settlement Date</span>
                <span>{formatDate(periodWithKPI.settlement.settledAt)}</span>
              </div>
              {periodWithKPI.settlement.txHash && (
                <div className="text-xs text-muted-foreground font-mono pt-2 border-t">
                  TX: {periodWithKPI.settlement.txHash.slice(0, 20)}...
                </div>
              )}
            </div>
          )}

          {/* Documents Info */}
          {period.dataUploadProgress && period.dataUploadProgress.blobCount > 0 && (
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{period.dataUploadProgress.blobCount} documents uploaded</span>
                <span>{period.dataUploadProgress.completeness}% complete</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {getActionButton()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
