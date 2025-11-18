/**
 * Walrus Storage Service
 *
 * Handles file upload and download operations with Walrus decentralized storage.
 * Provides backend relay for uploading encrypted files to Walrus network.
 */

import { WalrusClient, TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { config, debugConfig } from '@/src/shared/config/env';
import type {
  WalrusUploadResult,
  BlobInfo,
  BlobMetadata,
} from '@/src/shared/types/walrus';

/**
 * Walrus Service for backend file operations
 */
export class WalrusService {
  private walrusClient: WalrusClient;
  private suiClient: SuiClient;
  private backendKeypair: Ed25519Keypair | null = null;

  constructor() {
    // Initialize Sui client
    this.suiClient = new SuiClient({
      url: config.sui.rpcUrl!,
    });

    // Initialize Walrus client
    const packageConfig =
      config.sui.network === 'mainnet'
        ? TESTNET_WALRUS_PACKAGE_CONFIG // TODO: Use MAINNET_WALRUS_PACKAGE_CONFIG when available
        : TESTNET_WALRUS_PACKAGE_CONFIG;

    this.walrusClient = new WalrusClient({
      suiClient: this.suiClient,
      packageConfig,
      // Configure storage nodes from environment
      // Note: In production, this should dynamically discover storage nodes
    });

    // Initialize backend keypair for signing transactions
    if (config.sui.backendPrivateKey) {
      try {
        const privateKeyBytes = Buffer.from(config.sui.backendPrivateKey, 'base64');
        this.backendKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error('Failed to initialize backend keypair for Walrus:', error);
      }
    }

    if (debugConfig.walrus) {
      console.log('WalrusService initialized');
      console.log('Network:', config.sui.network);
      console.log('Aggregator URL:', config.walrus.aggregatorUrl);
      console.log('Storage Epochs:', config.walrus.storageEpochs);
    }
  }

  /**
   * Upload data to Walrus using upload relay pattern
   *
   * This method sends encrypted data to Walrus via the backend,
   * avoiding the need for ~2000 HTTP requests from the browser.
   *
   * @param data - Encrypted data to upload
   * @param metadata - Blob metadata
   * @returns Upload result with blob ID and commitment
   */
  async upload(data: Buffer, metadata: BlobMetadata): Promise<WalrusUploadResult> {
    try {
      if (debugConfig.walrus) {
        console.log('Uploading to Walrus via relay');
        console.log('Data size:', data.length, 'bytes');
        console.log('Storage epochs:', config.walrus.storageEpochs);
      }

      // Validate file size
      if (data.length > config.walrus.maxFileSize) {
        throw new Error(
          `File size ${data.length} exceeds maximum allowed ${config.walrus.maxFileSize} bytes`
        );
      }

      // Check if backend keypair is available
      if (!this.backendKeypair) {
        throw new Error('Backend keypair not configured for Walrus uploads');
      }

      // Convert Buffer to Uint8Array for Walrus SDK
      const blob = new Uint8Array(data);

      // Upload using upload relay pattern
      // Note: writeBlobToUploadRelay handles the heavy lifting of encoding and distributing to storage nodes
      const result = await this.walrusClient.writeBlobToUploadRelay({
        blob,
        deletable: true, // Allow blob deletion after expiry
        epochs: config.walrus.storageEpochs,
        signer: this.backendKeypair,
      });

      if (debugConfig.walrus) {
        console.log('Upload successful');
        console.log('Blob ID:', result.blobId);
        console.log('Certificate:', result.certificate);
      }

      // Calculate end epoch
      const systemState = await this.walrusClient.systemState();
      const currentEpoch = systemState.committee.epoch;
      const endEpoch = currentEpoch + config.walrus.storageEpochs;

      const uploadResult: WalrusUploadResult = {
        blobId: result.blobId,
        commitment: this.formatCertificate(result.certificate),
        size: data.length,
        uploadedAt: new Date().toISOString(),
        storageEpochs: config.walrus.storageEpochs,
        endEpoch,
      };

      return uploadResult;
    } catch (error) {
      console.error('Walrus upload failed:', error);
      throw new Error(
        `Failed to upload to Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download data from Walrus
   *
   * @param blobId - Blob ID to download
   * @returns Downloaded data as Buffer
   */
  async download(blobId: string): Promise<Buffer> {
    try {
      if (debugConfig.walrus) {
        console.log('Downloading from Walrus');
        console.log('Blob ID:', blobId);
      }

      // Read blob from Walrus storage nodes
      const data = await this.walrusClient.readBlob({
        blobId,
      });

      if (debugConfig.walrus) {
        console.log('Download successful');
        console.log('Data size:', data.length, 'bytes');
      }

      // Convert Uint8Array to Buffer
      return Buffer.from(data);
    } catch (error) {
      console.error('Walrus download failed:', error);
      throw new Error(
        `Failed to download from Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get blob metadata and status
   *
   * @param blobId - Blob ID to query
   * @returns Blob information
   */
  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    try {
      if (debugConfig.walrus) {
        console.log('Getting blob info');
        console.log('Blob ID:', blobId);
      }

      // Get blob status from storage nodes
      const status = await this.walrusClient.getVerifiedBlobStatus({
        blobId,
      });

      // Get blob metadata
      const metadata = await this.walrusClient.getBlobMetadata({
        blobId,
      });

      const systemState = await this.walrusClient.systemState();
      const currentEpoch = systemState.committee.epoch;

      const blobInfo: BlobInfo = {
        blobId,
        size: Number(metadata.metadata.V1.unencoded_length),
        commitment: this.formatMetadata(metadata),
        uploadedAt: new Date().toISOString(), // TODO: Get actual upload time from blockchain
        storageEpochs: 0, // TODO: Calculate from end_epoch - start_epoch
        endEpoch: currentEpoch, // TODO: Get from blob object on Sui
      };

      if (debugConfig.walrus) {
        console.log('Blob info retrieved');
        console.log('Size:', blobInfo.size, 'bytes');
        console.log('Status:', status);
      }

      return blobInfo;
    } catch (error) {
      console.error('Failed to get blob info:', error);
      throw new Error(
        `Failed to get blob info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate storage cost for a given size and epochs
   *
   * @param size - Data size in bytes
   * @param epochs - Number of storage epochs
   * @returns Cost breakdown
   */
  async calculateStorageCost(
    size: number,
    epochs: number = config.walrus.storageEpochs
  ): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    try {
      const cost = await this.walrusClient.storageCost(size, epochs);

      if (debugConfig.walrus) {
        console.log('Storage cost calculated');
        console.log('Size:', size, 'bytes');
        console.log('Epochs:', epochs);
        console.log('Total cost:', cost.totalCost.toString(), 'MIST');
      }

      return cost;
    } catch (error) {
      console.error('Failed to calculate storage cost:', error);
      throw new Error(
        `Failed to calculate storage cost: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Format certificate as commitment string
   */
  private formatCertificate(certificate: any): string {
    // Extract relevant information from certificate
    // For now, return a placeholder
    return `walrus:${JSON.stringify(certificate).substring(0, 64)}`;
  }

  /**
   * Format metadata as commitment string
   */
  private formatMetadata(metadata: any): string {
    // Extract hash from metadata
    try {
      const primaryHash = metadata.metadata.V1.hashes[0]?.primary_hash;
      if (primaryHash && primaryHash.$kind === 'Digest') {
        const hashBytes = primaryHash.Digest;
        const hashHex = Array.from(hashBytes as Uint8Array)
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join('');
        return `walrus:${hashHex}`;
      }
    } catch (error) {
      console.error('Failed to extract hash from metadata:', error);
    }
    return 'walrus:unknown';
  }

  /**
   * Validate blob ID format
   */
  private isValidBlobId(blobId: string): boolean {
    // Walrus blob IDs are typically base64-encoded
    // Add proper validation based on Walrus specification
    return blobId.length > 0 && /^[A-Za-z0-9_-]+$/.test(blobId);
  }
}

/**
 * Singleton instance of WalrusService
 */
export const walrusService = new WalrusService();
