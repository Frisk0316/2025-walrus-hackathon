/**
 * Seal Encryption Service
 *
 * Handles server-side encryption and decryption using @mysten/seal SDK.
 * Provides secure file encryption with access control managed by Seal policies on Sui blockchain.
 */

import { SealClient } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey } from '@mysten/seal';
import { config, debugConfig } from '@/src/shared/config/env';
import type {
  SealEncryptionConfig,
  SealEncryptionResult,
  SealDecryptionResult,
  AccessVerificationResult,
  UserRole,
} from '@/src/shared/types/walrus';

/**
 * Seal Service for server-side encryption/decryption
 */
export class SealService {
  private sealClient: SealClient;
  private suiClient: SuiClient;
  private backendKeypair: Ed25519Keypair | null = null;

  constructor() {
    // Initialize Sui client
    this.suiClient = new SuiClient({
      url: config.sui.rpcUrl!,
    });

    // Initialize Seal client with Key Server configurations
    this.sealClient = new SealClient({
      suiClient: this.suiClient,
      serverConfigs: this.getKeyServerConfigs(),
      verifyKeyServers: false, // Set to true in production after verifying key servers
      timeout: config.app.apiTimeout,
    });

    // Initialize backend keypair if private key is provided
    if (config.sui.backendPrivateKey) {
      try {
        // Decode base64 private key
        const privateKeyBytes = Buffer.from(config.sui.backendPrivateKey, 'base64');
        this.backendKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error('Failed to initialize backend keypair:', error);
      }
    }

    if (debugConfig.seal) {
      console.log('SealService initialized');
      console.log('Key Server Config:', this.getKeyServerConfigs());
      console.log('Policy Object ID:', config.seal.policyObjectId);
    }
  }

  /**
   * Get Key Server configurations
   *
   * Format based on Seal SDK requirements:
   * Each server config needs objectId (Sui object ID of key server) and weight
   *
   * Example testnet key servers:
   * - 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75
   * - 0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8
   */
  private getKeyServerConfigs() {
    // Get key server object IDs from environment
    // Format: SEAL_KEY_SERVER_OBJECT_IDS=0x123...,0x456...
    const keyServerObjectIds = process.env.SEAL_KEY_SERVER_OBJECT_IDS?.split(',') || [];

    if (keyServerObjectIds.length === 0) {
      console.warn('WARNING: No Seal Key Server object IDs configured');
      console.warn('Set SEAL_KEY_SERVER_OBJECT_IDS in environment variables');
      console.warn('Example: SEAL_KEY_SERVER_OBJECT_IDS=0x73d05d62...,0xf5d14a81...');
    }

    return keyServerObjectIds.map((objectId) => ({
      objectId: objectId.trim(),
      weight: 1, // Equal weight for all servers
    }));
  }

  /**
   * Encrypt file data using Seal
   *
   * @param plaintext - File data to encrypt
   * @param encryptionConfig - Seal encryption configuration
   * @returns Encrypted data with metadata
   */
  async encrypt(
    plaintext: Buffer,
    encryptionConfig: SealEncryptionConfig
  ): Promise<SealEncryptionResult> {
    if (!config.app.enableServerEncryption) {
      throw new Error('Server-side encryption is disabled');
    }

    if (!config.seal.policyObjectId) {
      throw new Error('Seal policy object ID is not configured');
    }

    try {
      if (debugConfig.seal) {
        console.log('Encrypting data with Seal');
        console.log('Policy Object ID:', encryptionConfig.policyObjectId);
        console.log('Data size:', plaintext.length, 'bytes');
      }

      // Convert Buffer to Uint8Array
      const data = new Uint8Array(plaintext);

      // Encrypt using Seal
      // Note: packageId should be the deployed earnout contract package ID
      const { encryptedObject } = await this.sealClient.encrypt({
        threshold: 2, // Require 2 out of 3 key servers (configurable)
        packageId: encryptionConfig.policyObjectId.split('::')[0], // Extract package ID
        id: encryptionConfig.dealId, // Use deal ID as identity
        data,
        // Optional: Add additional authenticated data (AAD)
        // aad: new TextEncoder().encode(encryptionConfig.periodId),
      });

      // Generate commitment (hash of encrypted object)
      const commitment = await this.generateCommitment(new Uint8Array(encryptedObject));

      const result: SealEncryptionResult = {
        ciphertext: Buffer.from(encryptedObject),
        commitment,
        policyObjectId: encryptionConfig.policyObjectId,
        encryptedAt: new Date().toISOString(),
      };

      if (debugConfig.seal) {
        console.log('Encryption successful');
        console.log('Ciphertext size:', result.ciphertext.length, 'bytes');
        console.log('Commitment:', commitment);
      }

      return result;
    } catch (error) {
      console.error('Seal encryption failed:', error);
      throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt file data using Seal
   *
   * @param ciphertext - Encrypted file data
   * @param dealId - Deal ID for access control
   * @param userAddress - User's Sui address
   * @returns Decrypted data with metadata
   */
  async decrypt(
    ciphertext: Buffer,
    dealId: string,
    userAddress: string
  ): Promise<SealDecryptionResult> {
    if (!config.app.enableServerEncryption) {
      throw new Error('Server-side decryption is disabled');
    }

    if (!this.backendKeypair) {
      throw new Error('Backend keypair is not configured for decryption');
    }

    try {
      if (debugConfig.seal) {
        console.log('Decrypting data with Seal');
        console.log('Deal ID:', dealId);
        console.log('User Address:', userAddress);
        console.log('Ciphertext size:', ciphertext.length, 'bytes');
      }

      // Ensure backend keypair is available
      if (!this.backendKeypair) {
        throw new Error('Backend keypair is required for server-side decryption');
      }

      // Convert Buffer to Uint8Array
      const data = new Uint8Array(ciphertext);

      // Parse encrypted object to get ID
      const { EncryptedObject } = await import('@mysten/seal');
      const parsedEncryptedBlob = EncryptedObject.parse(data);

      // Create session key for decryption
      // Note: In production, this should use the user's signer, not backend keypair
      // For server-side decryption, we use backend keypair as trusted intermediary
      const sessionKey = await SessionKey.create({
        address: this.backendKeypair.toSuiAddress(),
        packageId: config.seal.policyObjectId!.split('::')[0],
        ttlMin: 10, // 10 minute session
        suiClient: this.suiClient,
        signer: this.backendKeypair,
      });

      // Create transaction to approve decryption
      // Note: This is a simplified version - in production, you need to:
      // 1. Build proper transaction that calls seal_approve* functions from earnout_seal_policy
      // 2. Verify user's role in the deal on-chain
      // 3. Handle multi-sig if required
      const txBytes = new Uint8Array(0); // TODO: Build actual approval transaction

      // Fetch decryption keys from Seal Key Servers
      await this.sealClient.fetchKeys({
        ids: [parsedEncryptedBlob.id],
        txBytes,
        sessionKey,
        threshold: 2, // Must match encryption threshold
      });

      // Decrypt using Seal
      const plaintext = await this.sealClient.decrypt({
        data,
        sessionKey,
        txBytes,
        checkShareConsistency: true,
      });

      const result: SealDecryptionResult = {
        plaintext: Buffer.from(plaintext),
        metadata: {
          policyObjectId: config.seal.policyObjectId!,
          encryptedAt: new Date().toISOString(), // Should be retrieved from blob metadata
        },
      };

      if (debugConfig.seal) {
        console.log('Decryption successful');
        console.log('Plaintext size:', result.plaintext.length, 'bytes');
      }

      return result;
    } catch (error) {
      console.error('Seal decryption failed:', error);
      throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify if user has access to decrypt a file
   *
   * @param dealId - Deal ID to check access for
   * @param userAddress - User's Sui address
   * @param requiredRole - Required role (optional)
   * @returns Access verification result
   */
  async verifyAccess(
    dealId: string,
    userAddress: string,
    requiredRole?: UserRole
  ): Promise<AccessVerificationResult> {
    try {
      if (debugConfig.seal) {
        console.log('Verifying access for user:', userAddress);
        console.log('Deal ID:', dealId);
        console.log('Required role:', requiredRole || 'any');
      }

      // TODO: Query Sui blockchain to check if user has access
      // This should query the earnout contract to check:
      // 1. User is a participant in the deal (buyer, seller, or auditor)
      // 2. User has the required role (if specified)

      // Placeholder implementation
      // In production, this would query the Deal object on Sui:
      // const dealObject = await this.suiClient.getObject({
      //   id: dealId,
      //   options: { showContent: true }
      // });
      // Then check if userAddress is in buyer/seller/auditor fields

      // For now, allow all access (DEVELOPMENT ONLY)
      if (process.env.NODE_ENV === 'development') {
        console.warn('WARNING: Access verification is in development mode - allowing all access');
        return {
          hasAccess: true,
          role: 'buyer', // Placeholder
        };
      }

      // Production implementation would look like:
      // const role = await this.getUserRoleInDeal(dealId, userAddress);
      // if (!role) {
      //   return {
      //     hasAccess: false,
      //     reason: 'User is not a participant in this deal',
      //   };
      // }
      // if (requiredRole && role !== requiredRole) {
      //   return {
      //     hasAccess: false,
      //     reason: `User has role ${role}, but ${requiredRole} is required`,
      //   };
      // }
      // return { hasAccess: true, role };

      return {
        hasAccess: false,
        reason: 'Access verification not yet implemented',
      };
    } catch (error) {
      console.error('Access verification failed:', error);
      return {
        hasAccess: false,
        reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate cryptographic commitment for encrypted data
   *
   * @param data - Data to generate commitment for
   * @returns Hex-encoded commitment
   */
  private async generateCommitment(data: Uint8Array): Promise<string> {
    // Use SHA-256 to generate commitment
    // Convert Uint8Array to Buffer to ensure compatibility
    const buffer = Buffer.from(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }
}

/**
 * Singleton instance of SealService
 */
export const sealService = new SealService();
