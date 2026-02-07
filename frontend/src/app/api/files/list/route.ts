import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuth2Client, listFiles } from '@/lib/google-drive';
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

        // List files
        const files = await listFiles(oauth2Client);

        return NextResponse.json({
            success: true,
            files: files
        });

    } catch (error: any) {
        console.error('List files error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to list files' },
            { status: 500 }
        );
    }
}
