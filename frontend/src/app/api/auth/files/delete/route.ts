// app/api/files/delete/route.ts
// Delete file from Google Drive

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuth2Client, deleteFileFromDrive } from '@/lib/google-drive';
import { decrypt } from '@/lib/security';

export async function DELETE(request: NextRequest) {
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

        // Get file ID from query params
        const searchParams = request.nextUrl.searchParams;
        const fileId = searchParams.get('fileId');

        if (!fileId) {
            return NextResponse.json(
                { error: 'File ID required' },
                { status: 400 }
            );
        }

        // Delete file from Drive
        await deleteFileFromDrive(oauth2Client, fileId);

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully',
        });

    } catch (error: any) {
        console.error('Delete file error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete file' },
            { status: 500 }
        );
    }
}