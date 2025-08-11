// netlify/functions/update-agenda.js
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { agendaPath, updatedAgendaDetails, linksToAdd, linksToRemove, agendaId } = JSON.parse(event.body);
        
        const updates = {};
        
        // 1. Připraví aktualizaci pro samotnou agendu
        updates[agendaPath] = updatedAgendaDetails;

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
    } catch (error) {
        console.error("Chyba při aktualizaci agendy a vazeb:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update agenda.' }),
        };
    }
};
