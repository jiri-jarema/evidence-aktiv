// netlify/functions/update-support-asset.js
const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

// Pomocná funkce pro ověření uživatele a jeho role
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

    // Pouze administrátor může upravovat podpůrná aktiva
    if (user.role !== 'administrator') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
    }

    try {
        const { assetPath, updatedDetails, reciprocalLinks } = JSON.parse(event.body);
        
        const updates = {};
        
        // 1. Aktualizace detailů samotného aktiva
        updates[`${assetPath}/details`] = updatedDetails;

        // 2. Zpracování recipročních odkazů
        if (reciprocalLinks) {
            // Přidání nových odkazů
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

            // Odebrání starých odkazů
            for (const link of reciprocalLinks.toRemove) {
                const { targetPath, sourceId } = link;
                const snapshot = await db.ref(targetPath).once('value');
                let links = snapshot.val() || [];
                if (Array.isArray(links)) {
                    updates[targetPath] = links.filter(id => id !== sourceId);
                }
            }
        }

        // 3. Provedení všech změn najednou
        await db.ref().update(updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Support asset updated successfully.' }),
        };
    } catch (err) {
        console.error("Error updating support asset:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update support asset.' }),
        };
    }
};
