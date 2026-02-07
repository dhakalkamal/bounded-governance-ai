// app/api/auth/google/route.ts
// Initiate Google OAuth authentication

import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, getAuthUrl } from '@/lib/google-drive';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const oauth2Client = getOAuth2Client();
        const authUrl = getAuthUrl(oauth2Client);

        // Store a state token for security (CSRF protection)
        const state = Math.random().toString(36).substring(7);
        cookies().set('oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600, // 10 minutes
        });

        return NextResponse.json({
            authUrl: authUrl + `&state=${state}`
        });
    } catch (error: any) {
        console.error('OAuth error:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL' },
            { status: 500 }
        );
    }
}