'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useCreateDeal } from '@/src/frontend/hooks/useCreateDeal';
import { RoleAccessMessage } from '@/src/frontend/components/common/RoleAccessMessage';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Users, DollarSign, FileText, Upload, X, Package, Plus, Trash2, Wallet, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { AssetReference } from '@/src/shared/types/asset';
import { useUploadFile } from '@/src/frontend/hooks/useUploadFile'; // Import the upload hook

const createDealSchema = z.object({
  // Basic Information
  dealName: z.string().min(1, 'Deal name is required'),
  buyerName: z.string().min(1, 'Buyer name is required'),
  sellerName: z.string().min(1, 'Seller name is required'),

  // Blockchain Addresses
  acquirerAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address format'),
  acquireeAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address format'),
  auditorAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address format'),

  // Financial Parameters
  earnoutPeriodYears: z.number().int().min(1).max(10),
  kpiTargetAmount: z.number().positive(),
  contingentConsiderationAmount: z.number().positive(),
  headquarterExpenseAllocationPercentage: z.number().min(0).max(1),

  // Assets Management
  assets: z.array(z.object({
    assetID: z.string().min(1, 'Asset ID is required'),
    originalCost: z.number().positive('Original cost must be positive'),
    estimatedUsefulLife_months: z.number().int().min(1, 'Useful life must be at least 1 month'),
  })).min(1, 'At least one asset is required'),
});

type CreateDealFormData = z.infer<typeof createDealSchema>;

export default function CreateDealPage() {
  const router = useRouter();
  const { currentRole } = useRole();
  const currentAccount = useCurrentAccount();
  const { createDeal, isCreating } = useCreateDeal();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { uploadFile, isUploading } = useUploadFile(); // Use the upload hook

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      earnoutPeriodYears: 3,
      headquarterExpenseAllocationPercentage: 0.1,
      assets: [{ assetID: '', originalCost: 0, estimatedUsefulLife_months: 120 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'assets',
  });

  // Role-based access control: Only Buyer can create deals
  if (currentRole !== 'buyer') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/deals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Link>
        </Button>
        <RoleAccessMessage
          allowedRole="buyer"
          currentRole={currentRole}
          featureName="Deal creation"
        />
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setUploadedFile(file);
      toast.success('MA Agreement uploaded successfully');
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    toast.info('MA Agreement removed');
  };

  const onSubmit = async (data: CreateDealFormData) => {
    if (!uploadedFile) {
      toast.error('Please upload the M&A Agreement PDF');
      return;
    }

    if (!currentAccount?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Step 1: Upload the M&A Agreement to Walrus to get the blobId
      toast.info('Uploading M&A Agreement to Walrus...');
      const uploadResponse = await uploadFile({
        file: uploadedFile,
        dealId: 'temp-deal-id', // Placeholder, as deal is not created yet
        periodId: 'agreement',
        dataType: 'legal',
      });

      if (!uploadResponse.blobId) {
        throw new Error('Failed to get blobId from Walrus upload.');
      }
      toast.success('M&A Agreement uploaded successfully.');

      // Step 2: Prepare all data for the backend
      const dealDataForBackend = {
        name: data.dealName,
        buyerName: data.buyerName,
        sellerName: data.sellerName,
        sellerAddress: data.acquireeAddress,
        auditorAddress: data.auditorAddress,
        // --- Pass all the new fields ---
        kpiTarget: data.kpiTargetAmount,
        agreementBlobId: uploadResponse.blobId,
        assets: data.assets.map(asset => ({
          asset_id: asset.assetID,
          original_cost: asset.originalCost,
          estimated_useful_life_months: asset.estimatedUsefulLife_months,
        })),
      };

      // Step 3: Call the createDeal hook with the complete data
      await createDeal({
        dealData: dealDataForBackend,
        onSuccess: (txDigest) => {
          toast.success(`Deal "${data.dealName}" created successfully!`, {
            description: `Transaction: ${txDigest.slice(0, 10)}...`,
          });
          router.push('/deals');
        },
        onError: (error) => {
          toast.error('Failed to create deal', { description: error.message });
        },
      });
    } catch (uploadError) {
      console.error('Failed during upload or deal creation process:', uploadError);
      toast.error('An error occurred', { description: uploadError instanceof Error ? uploadError.message : 'Please try again.' });
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/deals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Create New Earn-out Deal</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new earn-out agreement with all required parameters and documentation
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Enter the fundamental details of the M&A transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dealName">Deal Name</Label>
              <Input
                id="dealName"
                placeholder="e.g., BuyYou Inc. & Global Tech Solutions Inc. Asset Purchase"
                {...register('dealName')}
              />
              {errors.dealName && (
                <p className="text-sm text-destructive mt-1">{errors.dealName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buyerName">Buyer Name</Label>
                <Input
                  id="buyerName"
                  placeholder="e.g., BuyYou Inc."
                  {...register('buyerName')}
                />
                {errors.buyerName && (
                  <p className="text-sm text-destructive mt-1">{errors.buyerName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="sellerName">Seller Name</Label>
                <Input
                  id="sellerName"
                  placeholder="e.g., Global Tech Solutions Inc."
                  {...register('sellerName')}
                />
                {errors.sellerName && (
                  <p className="text-sm text-destructive mt-1">{errors.sellerName.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blockchain Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Blockchain Addresses
            </CardTitle>
            <CardDescription>
              Sui wallet addresses for all parties involved in the deal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="acquirerAddress">Acquirer Address (Buyer)</Label>
              <Input
                id="acquirerAddress"
                placeholder="0x..."
                {...register('acquirerAddress')}
                className="font-mono text-sm"
              />
              {errors.acquirerAddress && (
                <p className="text-sm text-destructive mt-1">{errors.acquirerAddress.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="acquireeAddress">Acquiree Address (Seller)</Label>
              <Input
                id="acquireeAddress"
                placeholder="0x..."
                {...register('acquireeAddress')}
                className="font-mono text-sm"
              />
              {errors.acquireeAddress && (
                <p className="text-sm text-destructive mt-1">{errors.acquireeAddress.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="auditorAddress">Auditor Address</Label>
              <Input
                id="auditorAddress"
                placeholder="0x..."
                {...register('auditorAddress')}
                className="font-mono text-sm"
              />
              {errors.auditorAddress && (
                <p className="text-sm text-destructive mt-1">{errors.auditorAddress.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Parameters
            </CardTitle>
            <CardDescription>
              Configure the earn-out terms and KPI targets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="earnoutPeriodYears">Earn-out Period (Years)</Label>
              <Input
                id="earnoutPeriodYears"
                type="number"
                min="1"
                max="10"
                {...register('earnoutPeriodYears', { valueAsNumber: true })}
              />
              {errors.earnoutPeriodYears && (
                <p className="text-sm text-destructive mt-1">{errors.earnoutPeriodYears.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="kpiTargetAmount">KPI Target Amount (Net Profit)</Label>
              <Input
                id="kpiTargetAmount"
                type="number"
                step="0.01"
                placeholder="e.g., 900000"
                {...register('kpiTargetAmount', { valueAsNumber: true })}
              />
              {errors.kpiTargetAmount && (
                <p className="text-sm text-destructive mt-1">{errors.kpiTargetAmount.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Cumulative net profit target to trigger earn-out payment
              </p>
            </div>

            <div>
              <Label htmlFor="contingentConsiderationAmount">Contingent Consideration Amount</Label>
              <Input
                id="contingentConsiderationAmount"
                type="number"
                step="0.01"
                placeholder="e.g., 30000000"
                {...register('contingentConsiderationAmount', { valueAsNumber: true })}
              />
              {errors.contingentConsiderationAmount && (
                <p className="text-sm text-destructive mt-1">
                  {errors.contingentConsiderationAmount.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Amount to be paid if KPI target is met
              </p>
            </div>

            <div>
              <Label htmlFor="headquarterExpenseAllocationPercentage">
                Headquarter Expense Allocation (%)
              </Label>
              <Input
                id="headquarterExpenseAllocationPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 10"
                {...register('headquarterExpenseAllocationPercentage', {
                  valueAsNumber: true,
                  setValueAs: (v) => v / 100, // Convert percentage to decimal
                })}
              />
              {errors.headquarterExpenseAllocationPercentage && (
                <p className="text-sm text-destructive mt-1">
                  {errors.headquarterExpenseAllocationPercentage.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Percentage of corporate overhead pool allocated to this business unit
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assets Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Assets Management
            </CardTitle>
            <CardDescription>
              Specify the fixed assets included in this deal for depreciation calculation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Asset {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`assets.${index}.assetID`}>Asset ID</Label>
                    <Input
                      id={`assets.${index}.assetID`}
                      placeholder="e.g., MACH-001A"
                      {...register(`assets.${index}.assetID` as const)}
                    />
                    {errors.assets?.[index]?.assetID && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.assets[index]?.assetID?.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`assets.${index}.originalCost`}>
                        Original Cost (USD)
                      </Label>
                      <Input
                        id={`assets.${index}.originalCost`}
                        type="number"
                        step="1"
                        min="0"
                        placeholder="e.g., 500000"
                        {...register(`assets.${index}.originalCost` as const, {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.assets?.[index]?.originalCost && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.assets[index]?.originalCost?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`assets.${index}.estimatedUsefulLife_months`}>
                        Estimated Useful Life (Months)
                      </Label>
                      <Input
                        id={`assets.${index}.estimatedUsefulLife_months`}
                        type="number"
                        min="1"
                        placeholder="e.g., 120"
                        {...register(`assets.${index}.estimatedUsefulLife_months` as const, {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.assets?.[index]?.estimatedUsefulLife_months && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.assets[index]?.estimatedUsefulLife_months?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ assetID: '', originalCost: 0, estimatedUsefulLife_months: 120 })}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>

            {errors.assets?.root && (
              <p className="text-sm text-destructive">{errors.assets.root.message}</p>
            )}
          </CardContent>
        </Card>

        {/* M&A Agreement Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              M&A Agreement Document
            </CardTitle>
            <CardDescription>
              Upload the signed M&A agreement PDF (required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!uploadedFile ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="ma-agreement"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="ma-agreement" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-1">Click to upload M&A Agreement</p>
                  <p className="text-xs text-muted-foreground">PDF file, max 10MB</p>
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Connection & Submit */}
        <Card>
          <CardContent className="pt-6">
            {!currentAccount ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Wallet className="h-5 w-5" />
                  <span>Connect your wallet to create a deal</span>
                </div>
                <WalletButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <span>Connected: {currentAccount.address.slice(0, 8)}...{currentAccount.address.slice(-6)}</span>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/deals')}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating || isUploading || !uploadedFile}>
                    {isCreating || isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isUploading ? 'Uploading File...' : 'Creating Deal...'}
                      </>
                    ) : (
                      'Create Deal'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
