// app/api/files/list/route.ts
// List files from Google Drive

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuth2Client, listFilesFromDrive } from '@/lib/google-drive';
import { decrypt } from '@/lib/security';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const encryptedTokens = cookies().get('google_tokens')?.value;
        if (!encryptedTokens) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Decrypt tokens
        const tokens = JSON.parse(decrypt(encryptedTokens));
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const docType = searchParams.get('docType');
        const pageSize = parseInt(searchParams.get('pageSize') || '100');

        // Build query to filter files
        let query = "trashed = false";

        // Filter by document type if specified
        if (docType && docType !== 'all') {
            query += ` and properties has { key='docType' and value='${docType}' }`;
        }

        // List files from Drive
        const files = await listFilesFromDrive(oauth2Client, {
            pageSize,
            query,
            orderBy: 'createdTime desc',
        });

        return NextResponse.json({
            success: true,
            files,
            total: files.length,
        });

    } catch (error: any) {
        console.error('List files error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to list files' },
            { status: 500 }
        );
    }
}