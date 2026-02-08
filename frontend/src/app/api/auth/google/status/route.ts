import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const tokens = cookies().get('google_tokens')?.value;

    // Also check for environment variable refresh token for "headless" mode
    const hasEnvRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;

    return NextResponse.json({
        connected: !!tokens || hasEnvRefreshToken
    });
}
