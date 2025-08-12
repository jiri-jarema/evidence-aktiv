// netlify/functions/create-agenda.js
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

    // Ověření uživatele
    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) {
        return error;
    }

    try {
        const { odborId, newAgendaId, newAgendaData } = JSON.parse(event.body);

        // Kontrola oprávnění pro zápis
        const canWrite = user.role === 'administrator' || (user.role === 'garant' && user.odbor === odborId);

        if (!canWrite) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
        }

        const agendaPath = `agendy/children/${odborId}/children/${newAgendaId}`;
        await db.ref(agendaPath).set(newAgendaData);

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, message: 'Agenda created successfully.' }),
        };

    } catch (err) {
        console.error("Error creating agenda:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create agenda.' }),
        };
    }
};
