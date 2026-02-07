import { google } from 'googleapis';
import { Readable } from 'stream';

export const getOAuth2Client = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google Client ID or Secret');
    }

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
};

console.log("ENV CHECK:", {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect: process.env.GOOGLE_REDIRECT_URI,
});

export const getAuthUrl = (oauth2Client: any) => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive.metadata.readonly'
        ],
        prompt: 'consent' // Force refresh token generation
    });
};

export const getTokensFromCode = async (oauth2Client: any, code: string) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

export const deleteFileFromDrive = async (auth: any, fileId: string) => {
    const drive = google.drive({ version: 'v3', auth });
    try {
        await drive.files.delete({
            fileId: fileId,
        });
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
};

export const uploadFileToDrive = async (
    auth: any,
    file: File | Buffer,
    fileName: string,
    mimeType: string,
    folderId?: string
) => {
    const drive = google.drive({ version: 'v3', auth });

    try {
        const fileMetadata: any = {
            name: fileName,
        };

        if (folderId) {
            fileMetadata.parents = [folderId];
        }

        const media = {
            mimeType: mimeType,
            body: file instanceof Buffer
                ? Readable.from(file)
                : Readable.from(Buffer.from(await (file as File).arrayBuffer())),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

export const listFiles = async (auth: any) => {
    const drive = google.drive({ version: 'v3', auth });
    try {
        const response = await drive.files.list({
            pageSize: 50,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink, webContentLink)',
            orderBy: 'createdTime desc',
            q: "trashed = false", // Only non-trashed files
        });
        return response.data.files;
    } catch (error) {
        console.error('Error listing files:', error);
        throw error;
    }
};
