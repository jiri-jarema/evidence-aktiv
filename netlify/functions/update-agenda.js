// netlify/functions/update-agenda.js
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
        const { agendaPath, updatedAgendaDetails, linksToAdd, linksToRemove, agendaId } = JSON.parse(event.body);
        
        // Získání ID odboru z cesty k agendě
        const odborId = agendaPath.split('/')[2];
        if (!odborId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Invalid agenda path.' }) };
        }

        // Kontrola oprávnění pro zápis
        const canWrite = user.role === 'administrator' || (user.role === 'garant' && user.odbor === odborId);

        if (!canWrite) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
        }

        const updates = {};
        
        // 1. Připraví aktualizaci pro samotnou agendu
        updates[`${agendaPath}/details`] = updatedAgendaDetails;

        // 2. Připraví přidání zpětných odkazů z informačních systémů
        for (const systemId of linksToAdd) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Osobní údaje/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val() || [];
            if (!links.includes(agendaId)) {
                links.push(agendaId);
            }
            updates[systemLinksPath] = links;
        }

        // 3. Připraví odebrání zpětných odkazů z informačních systémů
        for (const systemId of linksToRemove) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Osobní údaje/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val() || [];
            links = links.filter(id => id !== agendaId);
            updates[systemLinksPath] = links;
        }

        // 4. Provede všechny změny najednou v jedné operaci
        await db.ref().update(updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (err) {
        console.error("Chyba při aktualizaci agendy a vazeb:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update agenda.' }),
        };
    }
};
