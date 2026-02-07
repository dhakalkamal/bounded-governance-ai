// app/api/auth/google/callback/route.ts
// Handle OAuth callback and store tokens

import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, getTokensFromCode } from '@/lib/google-drive';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/security';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = cookies().get('oauth_state')?.value;

    // Verify state to prevent CSRF attacks
    if (!state || state !== storedState) {
        return NextResponse.redirect(
            new URL('/documents?error=invalid_state', request.url)
        );
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/documents?error=no_code', request.url)
        );
    }

    try {
        const oauth2Client = getOAuth2Client();
        const tokens = await getTokensFromCode(oauth2Client, code);

        // Encrypt and store tokens in httpOnly cookie
        const encryptedTokens = encrypt(JSON.stringify(tokens));

        cookies().set('google_tokens', encryptedTokens, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        // Clear the state cookie
        cookies().delete('oauth_state');

        // Redirect back to documents page
        return NextResponse.redirect(
            new URL('/documents?connected=true', request.url)
        );
    } catch (error: any) {
        console.error('Token exchange error:', error);
        return NextResponse.redirect(
            new URL('/documents?error=auth_failed', request.url)
        );
    }
}