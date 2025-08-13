// netlify/functions/create-support-asset.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

async function verifyUser(authorization) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { error: { statusCode: 401, body: 'Unauthorized: Missing token' } };
    }
    const idToken = authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const userData = userSnapshot.val();
        if (!userData || !userData.role) {
            return { error: { statusCode: 403, body: 'Forbidden: No role assigned' } };
        }
        return { user: { uid, ...userData } };
    } catch (error) {
        console.error("Token verification failed:", error);
        return { error: { statusCode: 401, body: 'Unauthorized: Invalid token' } };
    }
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) return error;

    if (user.role !== 'administrator') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions. Administrator role required.' }) };
    }

    try {
        const { assetPath, newAssetData, reciprocalLinks } = JSON.parse(event.body);
        
        const updates = {};
        
        // Set the new asset data
        updates[assetPath] = newAssetData;

        // Handle reciprocal links to add
        if (reciprocalLinks && reciprocalLinks.toAdd) {
            for (const link of reciprocalLinks.toAdd) {
                const { targetPath, sourceId } = link;
                const snapshot = await db.ref(targetPath).once('value');
                let links = snapshot.val() || [];
                if (!Array.isArray(links)) links = [];
                if (!links.includes(sourceId)) {
                    links.push(sourceId);
                }
                updates[targetPath] = links;
            }
        }

        await db.ref().update(updates);

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, message: 'Asset created successfully.' }),
        };
    } catch (err) {
        console.error("Error creating asset:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create asset.' }),
        };
    }
};
