// netlify/functions/update-service.js
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
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
    }

    try {
        const { serviceId, updatedDetails, linksToAdd, linksToRemove } = JSON.parse(event.body);
        
        const updates = {};
        const servicePath = `primarni/children/sluzby/children/${serviceId}/details`;
        updates[servicePath] = updatedDetails;

        // Handle adding reciprocal links from Information Systems
        for (const systemId of linksToAdd) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Regulovaná_služba/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val() || [];
            if (!Array.isArray(links)) links = [];
            if (!links.includes(serviceId)) {
                links.push(serviceId);
            }
            updates[systemLinksPath] = links;
        }

        // Handle removing reciprocal links from Information Systems
        for (const systemId of linksToRemove) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Regulovaná_služba/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val() || [];
            if (Array.isArray(links)) {
                updates[systemLinksPath] = links.filter(id => id !== serviceId);
            }
        }

        await db.ref().update(updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Service updated successfully.' }),
        };
    } catch (err) {
        console.error("Error updating service:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update service.' }),
        };
    }
};
