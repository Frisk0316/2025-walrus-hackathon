/**
 * Sui Blockchain Service
 *
 * Handles interactions with Sui blockchain for querying on-chain data.
 */

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { config, debugConfig } from '@/src/shared/config/env';

/**
 * On-chain blob reference from Deal object
 */
export interface OnChainBlobReference {
  blobId: string;
  periodId: string;
  dataType: string;
  size: number;
  uploadedAt: string;
  uploaderAddress: string;
}

/**
 * Data Audit Record from blockchain
 */
export interface DataAuditRecord {
  id: string;
  dataId: string;           // Walrus blob ID
  dealId: string;           // Parent Deal ID
  periodId: string;         // Parent Period ID
  uploader: string;         // Uploader address
  uploadTimestamp: number;  // Upload timestamp (ms)
  audited: boolean;         // Audit status
  auditor?: string;         // Auditor address (optional)
  auditTimestamp?: number;  // Audit timestamp (optional)
}

/**
 * Sui Service for blockchain queries
 */
export class SuiService {
  private client: SuiClient;

  constructor() {
    const network = config.sui.network || 'testnet';
    this.client = new SuiClient({ url: getFullnodeUrl(network) });

    if (debugConfig.sui) {
      console.log('SuiService initialized');
      console.log('Network:', network);
    }
  }

  /**
   * Query all blob IDs registered for a deal
   *
   * This method fetches the Deal object from Sui blockchain and extracts
   * the list of Walrus blob IDs that have been registered via add_walrus_blob.
   *
   * @param dealId - Deal object ID on Sui
   * @returns Array of blob IDs registered for this deal
   */
  async getDealBlobIds(dealId: string): Promise<string[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying blob IDs for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query on-chain blobs');
        return [];
      }

      // Fetch the Deal object from blockchain
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!dealObject.data) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      // Extract blob references from Deal object
      // The exact field structure depends on the Move module definition
      // Expected structure: Deal { ..., walrus_blobs: vector<BlobReference>, ... }
      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid Deal object structure');
      }

      const fields = content.fields as Record<string, unknown>;

      // Extract blob IDs from walrus_blobs field
      // This is a simplified implementation - adjust based on actual Move struct
      const walrusBlobs = fields.walrus_blobs as Array<{ blobId: string }> | undefined;

      if (!walrusBlobs || !Array.isArray(walrusBlobs)) {
        if (debugConfig.sui) {
          console.log('No walrus_blobs field found in Deal object, returning empty list');
        }
        return [];
      }

      const blobIds = walrusBlobs.map(blob => blob.blobId);

      if (debugConfig.sui) {
        console.log(`Found ${blobIds.length} blobs for deal ${dealId}`);
      }

      return blobIds;
    } catch (error) {
      console.error('Failed to query deal blob IDs:', error);
      throw new Error(
        `Failed to query on-chain blob data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query detailed blob references for a deal
   *
   * Returns full blob reference data including period, data type, etc.
   *
   * @param dealId - Deal object ID on Sui
   * @returns Array of on-chain blob references
   */
  async getDealBlobReferences(dealId: string): Promise<OnChainBlobReference[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying all blob references for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query on-chain blobs');
        return [];
      }

      // Fetch the Deal object from blockchain
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!dealObject.data) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid Deal object structure');
      }

      const fields = content.fields as Record<string, unknown>;

      // Extract blob references from walrus_blobs field
      const walrusBlobs = fields.walrus_blobs as Array<{
        blob_id?: string;
        blobId?: string;
        period_id?: string;
        periodId?: string;
        data_type?: string;
        dataType?: string;
        size?: number;
        uploaded_at?: number;
        uploadedAt?: number;
        uploader?: string;
        uploaderAddress?: string;
      }> | undefined;

      if (!walrusBlobs || !Array.isArray(walrusBlobs)) {
        if (debugConfig.sui) {
          console.log('No walrus_blobs field found in Deal object, returning empty list');
        }
        return [];
      }

      // Map to OnChainBlobReference format
      const blobReferences: OnChainBlobReference[] = walrusBlobs.map(blob => ({
        blobId: blob.blob_id || blob.blobId || '',
        periodId: blob.period_id || blob.periodId || '',
        dataType: blob.data_type || blob.dataType || '',
        size: blob.size || 0,
        uploadedAt: blob.uploaded_at
          ? new Date(blob.uploaded_at * 1000).toISOString()
          : blob.uploadedAt
          ? new Date(blob.uploadedAt).toISOString()
          : new Date().toISOString(),
        uploaderAddress: blob.uploader || blob.uploaderAddress || '',
      }));

      if (debugConfig.sui) {
        console.log(`Found ${blobReferences.length} blob references for deal ${dealId}`);
      }

      return blobReferences;
    } catch (error) {
      console.error('Failed to query deal blob references:', error);
      throw new Error(
        `Failed to query on-chain blob data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query all DataAuditRecord objects for a specific deal
   *
   * Uses Sui events to find all DataAuditRecordCreated events and fetches the objects
   *
   * @param dealId - Deal object ID
   * @returns Array of DataAuditRecord objects
   */
  async getDealAuditRecords(dealId: string): Promise<DataAuditRecord[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying audit records for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query audit records');
        return [];
      }

      // Query DataAuditRecordCreated events for this deal
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${config.earnout.packageId}::earnout::DataAuditRecordCreated`,
        },
        limit: 1000, // Adjust based on expected number of audit records
      });

      if (debugConfig.sui) {
        console.log(`Found ${events.data.length} DataAuditRecordCreated events`);
      }

      // Filter events for this deal and extract audit record IDs
      const auditRecordIds: string[] = [];
      for (const event of events.data) {
        const parsedJson = event.parsedJson as {
          audit_record_id?: string;
          deal_id?: string;
        };

        if (parsedJson.deal_id === dealId && parsedJson.audit_record_id) {
          auditRecordIds.push(parsedJson.audit_record_id);
        }
      }

      if (auditRecordIds.length === 0) {
        if (debugConfig.sui) {
          console.log('No audit records found for this deal');
        }
        return [];
      }

      // Fetch all audit record objects
      const auditRecords: DataAuditRecord[] = [];
      for (const recordId of auditRecordIds) {
        try {
          const obj = await this.client.getObject({
            id: recordId,
            options: {
              showContent: true,
            },
          });

          if (!obj.data) continue;

          const content = obj.data.content;
          if (!content || content.dataType !== 'moveObject') continue;

          const fields = content.fields as {
            data_id?: string;
            deal_id?: string;
            period_id?: string;
            uploader?: string;
            upload_timestamp?: string;
            audited?: boolean;
            auditor?: { vec?: string[] };
            audit_timestamp?: { vec?: string[] };
          };

          auditRecords.push({
            id: recordId,
            dataId: fields.data_id || '',
            dealId: fields.deal_id || '',
            periodId: fields.period_id || '',
            uploader: fields.uploader || '',
            uploadTimestamp: fields.upload_timestamp ? parseInt(fields.upload_timestamp) : 0,
            audited: fields.audited || false,
            auditor: fields.auditor?.vec?.[0],
            auditTimestamp: fields.audit_timestamp?.vec?.[0] ? parseInt(fields.audit_timestamp.vec[0]) : undefined,
          });
        } catch (error) {
          console.error(`Failed to fetch audit record ${recordId}:`, error);
          continue;
        }
      }

      if (debugConfig.sui) {
        console.log(`Retrieved ${auditRecords.length} audit records for deal ${dealId}`);
      }

      return auditRecords;
    } catch (error) {
      console.error('Failed to query audit records:', error);
      throw new Error(
        `Failed to query audit records: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query audit record for a specific blob
   *
   * @param dealId - Deal object ID
   * @param blobId - Blob ID (data_id in audit record)
   * @returns DataAuditRecord or null if not found
   */
  async getBlobAuditRecord(dealId: string, blobId: string): Promise<DataAuditRecord | null> {
    try {
      const auditRecords = await this.getDealAuditRecords(dealId);
      return auditRecords.find(record => record.dataId === blobId) || null;
    } catch (error) {
      console.error('Failed to query blob audit record:', error);
      return null;
    }
  }

  /**
   * Verify if user is a participant in a deal
   *
   * @param dealId - Deal object ID
   * @param userAddress - Sui address to verify
   * @returns Whether user is a participant (buyer/seller/auditor)
   */
  async verifyDealParticipant(dealId: string, userAddress: string): Promise<boolean> {
    try {
      if (debugConfig.sui) {
        console.log('Verifying deal participant:', userAddress, 'for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, skipping participant verification');
        return true; // Allow access if not configured (development mode)
      }

      // Fetch the Deal object
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
        },
      });

      if (!dealObject.data) {
        return false;
      }

      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        return false;
      }

      const fields = content.fields as Record<string, unknown>;

      // Check if user is buyer, seller, or auditor
      const buyer = fields.buyer as string | undefined;
      const seller = fields.seller as string | undefined;
      const auditor = fields.auditor as string | undefined;

      const isParticipant =
        buyer === userAddress ||
        seller === userAddress ||
        auditor === userAddress;

      if (debugConfig.sui) {
        console.log('Participant verification result:', isParticipant);
      }

      return isParticipant;
    } catch (error) {
      console.error('Failed to verify deal participant:', error);
      // Return false on error for security
      return false;
    }
  }
}

/**
 * Singleton instance of SuiService
 */
export const suiService = new SuiService();
