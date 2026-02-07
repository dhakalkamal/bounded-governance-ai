// app/api/upload/route.ts
// Upload file to Google Drive

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuth2Client, uploadFileToDrive, validateFile } from '@/lib/google-drive';
import { decrypt } from '@/lib/security';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const encryptedTokens = cookies().get('google_tokens')?.value;
        if (!encryptedTokens) {
            return NextResponse.json(
                { error: 'Not authenticated. Please connect to Google Drive first.' },
                { status: 401 }
            );
        }

        // Decrypt tokens
        const tokens = JSON.parse(decrypt(encryptedTokens));
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const docType = formData.get('docType') as string || 'other';

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file
        const validation = validateFile({
            name: file.name,
            size: file.size,
            mimeType: file.type,
        });

        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Sanitize filename
        const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 255);

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Google Drive
        const driveFile = await uploadFileToDrive(
            oauth2Client,
            {
                name: sanitizedName,
                mimeType: file.type,
                buffer: buffer,
            },
            {
                description: `Governance document - ${docType}`,
                properties: {
                    docType: docType,
                    uploadedAt: new Date().toISOString(),
                    originalName: file.name,
                },
            }
        );

        return NextResponse.json({
            success: true,
            fileId: driveFile.id,
            fileName: driveFile.name,
            mimeType: driveFile.mimeType,
            size: driveFile.size,
            webViewLink: driveFile.webViewLink,
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}