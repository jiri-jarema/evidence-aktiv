// netlify/functions/delete-agenda.js
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

// Helper function to verify user and admin role
async function verifyAdmin(authorization) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { error: { statusCode: 401, body: 'Unauthorized: Missing token' } };
    }
    const idToken = authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const userData = userSnapshot.val();
        if (!userData || userData.role !== 'administrator') {
            return { error: { statusCode: 403, body: 'Forbidden: Administrator role required' } };
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

    const { user, error } = await verifyAdmin(event.headers.authorization);
    if (error) return error;

    try {
        const { agendaId, agendaPath, linkedSystems } = JSON.parse(event.body);
        
        if (!agendaId || !agendaPath) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing agendaId or agendaPath.' }) };
        }

        const updates = {};
        
        // 1. Mark the agenda for deletion
        updates[agendaPath] = null;

        // 2. Remove reciprocal links from information systems
        if (linkedSystems && Array.isArray(linkedSystems)) {
            for (const systemId of linkedSystems) {
                const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Agendy/linksTo`;
                const snapshot = await db.ref(systemLinksPath).once('value');
                let links = snapshot.val();
                if (Array.isArray(links)) {
                    const filteredLinks = links.filter(id => id !== agendaId);
                    updates[systemLinksPath] = filteredLinks.length > 0 ? filteredLinks : null; // Set to null if array becomes empty
                }
            }
        }

        // 3. Perform the atomic update
        await db.ref().update(updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Agenda and reciprocal links deleted successfully.' }),
        };
    } catch (err) {
        console.error("Error deleting agenda:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete agenda.' }),
        };
    }
};
