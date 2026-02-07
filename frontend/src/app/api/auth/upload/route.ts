import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuth2Client, uploadFileToDrive } from '@/lib/google-drive';
import { decrypt } from '@/lib/security';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const encryptedTokens = cookies().get('google_tokens')?.value;
        if (!encryptedTokens) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Decrypt tokens
        const tokens = JSON.parse(decrypt(encryptedTokens));
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        // Upload to Drive
        const result = await uploadFileToDrive(
            oauth2Client,
            file,
            file.name,
            file.type
        );

        return NextResponse.json({
            success: true,
            file: result,
            message: 'File uploaded successfully',
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload file' },
            { status: 500 }
        );
    }
}
