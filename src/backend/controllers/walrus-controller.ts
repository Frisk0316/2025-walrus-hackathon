/**
 * Walrus Controller
 *
 * Handles HTTP requests for Walrus file upload and download operations.
 * Orchestrates between Seal encryption and Walrus storage services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sealService } from '@/src/backend/services/seal-service';
import { walrusService } from '@/src/backend/services/walrus-service';
import { config } from '@/src/shared/config/env';
import type {
  EncryptionMode,
  WalrusUploadResponse,
  BlobMetadata,
  SealEncryptionConfig,
} from '@/src/shared/types/walrus';

/**
 * Walrus Controller for file operations
 */
export class WalrusController {
  /**
   * Handle file upload with hybrid encryption mode
   *
   * @param request - NextRequest
   * @param mode - Encryption mode
   * @returns Upload response
   */
  async handleUpload(request: NextRequest, mode: EncryptionMode): Promise<NextResponse> {
    try {
      // Extract user information from headers
      const userAddress = request.headers.get('X-Sui-Address');
      const signature = request.headers.get('X-Sui-Signature');

      if (!userAddress || !signature) {
        return NextResponse.json(
          {
            error: 'UnauthorizedError',
            message: 'Missing authentication headers',
            statusCode: 401,
          },
          { status: 401 }
        );
      }

      // TODO: Verify signature
      // await this.verifySignature(userAddress, signature);

      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const dealId = formData.get('dealId') as string;
      const periodId = formData.get('periodId') as string;
      const dataType = formData.get('dataType') as string;
      const filename = formData.get('filename') as string;
      const description = formData.get('description') as string | null;
      const customDataType = formData.get('customDataType') as string | null;

      // Validate required fields
      if (!file) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'File is required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      if (!dealId || !periodId || !dataType) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'dealId, periodId, and dataType are required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      // Convert file to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Check file size
      if (fileBuffer.length > config.walrus.maxFileSize) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `File size exceeds maximum allowed (${config.walrus.maxFileSize} bytes)`,
            statusCode: 400,
            details: {
              maxSize: config.walrus.maxFileSize,
              actualSize: fileBuffer.length,
            },
          },
          { status: 400 }
        );
      }

      // Prepare blob metadata
      const metadata: BlobMetadata = {
        filename: filename || file.name,
        mimeType: file.type || 'application/octet-stream',
        description: description || undefined,
        periodId,
        encrypted: true,
        encryptionMode: mode,
        uploadedAt: new Date().toISOString(),
        uploaderAddress: userAddress,
        dataType: dataType as any,
        customDataType: customDataType || undefined,
      };

      // Process based on encryption mode
      let dataToUpload: Buffer;

      if (mode === 'server_encrypted') {
        // Server-side encryption mode
        if (!config.app.enableServerEncryption) {
          return NextResponse.json(
            {
              error: 'ForbiddenError',
              message: 'Server-side encryption is disabled',
              statusCode: 403,
            },
            { status: 403 }
          );
        }

        // Encrypt file using Seal
        const encryptionConfig: SealEncryptionConfig = {
          policyObjectId: config.seal.policyObjectId!,
          dealId,
          periodId,
        };

        const encryptionResult = await sealService.encrypt(fileBuffer, encryptionConfig);
        dataToUpload = encryptionResult.ciphertext;

        console.log('Server-side encryption completed');
        console.log('Original size:', fileBuffer.length, 'bytes');
        console.log('Encrypted size:', dataToUpload.length, 'bytes');
      } else {
        // Client-side encryption mode (default)
        // File should already be encrypted by frontend
        dataToUpload = fileBuffer;
        console.log('Client-encrypted file received');
        console.log('Ciphertext size:', dataToUpload.length, 'bytes');
      }

      // Upload to Walrus
      const uploadResult = await walrusService.upload(dataToUpload, metadata);

      // Build response
      const response: WalrusUploadResponse = {
        blobId: uploadResult.blobId,
        commitment: uploadResult.commitment,
        size: uploadResult.size,
        uploadedAt: uploadResult.uploadedAt,
        blobReference: {
          blobId: uploadResult.blobId,
          dataType: metadata.dataType,
          uploadedAt: uploadResult.uploadedAt,
          uploaderAddress: userAddress,
          size: uploadResult.size,
          metadata,
        },
        nextStep: {
          action: 'register_on_chain',
          description: 'Sign transaction to register this blob on-chain',
          transaction: {
            txBytes: '', // TODO: Generate actual transaction bytes
            description: `Register Walrus blob: ${dataType} for ${periodId}`,
          },
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Upload failed:', error);
      return NextResponse.json(
        {
          error: 'WalrusUploadError',
          message: 'Failed to upload file to Walrus network',
          statusCode: 500,
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle file download with hybrid decryption mode
   *
   * @param request - NextRequest
   * @param blobId - Blob ID to download
   * @param mode - Decryption mode
   * @param dealId - Deal ID for authorization
   * @returns Downloaded file
   */
  async handleDownload(
    request: NextRequest,
    blobId: string,
    mode: EncryptionMode,
    dealId: string | null
  ): Promise<NextResponse> {
    try {
      // Extract user information from headers
      const userAddress = request.headers.get('X-Sui-Address');
      const signature = request.headers.get('X-Sui-Signature');

      if (!userAddress || !signature) {
        return NextResponse.json(
          {
            error: 'UnauthorizedError',
            message: 'Missing authentication headers',
            statusCode: 401,
          },
          { status: 401 }
        );
      }

      if (!dealId) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'dealId query parameter is required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      // TODO: Verify signature
      // await this.verifySignature(userAddress, signature);

      // Verify user has access to this blob
      const accessResult = await sealService.verifyAccess(dealId, userAddress);

      if (!accessResult.hasAccess) {
        return NextResponse.json(
          {
            error: 'ForbiddenError',
            message: 'User is not authorized to access this blob',
            statusCode: 403,
            details: {
              reason: accessResult.reason,
              userAddress,
              dealId,
            },
          },
          { status: 403 }
        );
      }

      // Download from Walrus
      const encryptedData = await walrusService.download(blobId);

      // Process based on decryption mode
      let dataToReturn: Buffer;

      if (mode === 'server_encrypted') {
        // Server-side decryption mode
        if (!config.app.enableServerEncryption) {
          return NextResponse.json(
            {
              error: 'ForbiddenError',
              message: 'Server-side decryption is disabled',
              statusCode: 403,
            },
            { status: 403 }
          );
        }

        // Decrypt file using Seal
        const decryptionResult = await sealService.decrypt(encryptedData, dealId, userAddress);
        dataToReturn = decryptionResult.plaintext;

        console.log('Server-side decryption completed');
        console.log('Encrypted size:', encryptedData.length, 'bytes');
        console.log('Decrypted size:', dataToReturn.length, 'bytes');
      } else {
        // Client-side decryption mode (default)
        // Return encrypted data for frontend to decrypt
        dataToReturn = encryptedData;
        console.log('Returning encrypted data for client-side decryption');
        console.log('Ciphertext size:', dataToReturn.length, 'bytes');
      }

      // Return binary data
      return new NextResponse(dataToReturn, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': dataToReturn.length.toString(),
          'X-Blob-Id': blobId,
          'X-Encryption-Mode': mode,
        },
      });
    } catch (error) {
      console.error('Download failed:', error);

      // Check if it's a not found error
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'NotFoundError',
            message: 'Blob not found on Walrus network',
            statusCode: 404,
            details: {
              blobId,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'WalrusDownloadError',
          message: 'Failed to download blob from Walrus network',
          statusCode: 500,
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  }

  /**
   * Verify Sui signature (placeholder)
   * TODO: Implement actual signature verification
   */
  private async verifySignature(address: string, signature: string): Promise<boolean> {
    // Placeholder for signature verification
    // In production, verify that the signature was created by the address
    // and signed the expected message
    return true;
  }
}

/**
 * Singleton instance of WalrusController
 */
export const walrusController = new WalrusController();
