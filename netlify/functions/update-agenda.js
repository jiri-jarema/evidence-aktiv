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

// Opravená funkce pro nalezení cesty k regulované službě
async function findServicePath(serviceId) {
    const sluzbyRef = db.ref('primarni/children/sluzby/children');
    const snapshot = await sluzbyRef.once('value');
    const serviceCategories = snapshot.val();
    
    for (const categoryId in serviceCategories) {
        const category = serviceCategories[categoryId];
        if (category.children && category.children[serviceId]) {
            return `${categoryId}/children/${serviceId}`;
        }
    }
    return null;
}


exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) return error;

    try {
        const { agendaPath, newName, updatedAgendaDetails, linksToAdd, linksToRemove, serviceLinks, agendaId } = JSON.parse(event.body);
        
        const odborId = agendaPath.split('/')[2];
        if (!odborId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Invalid agenda path.' }) };
        }

        const canWrite = user.role === 'administrator' || (user.role === 'garant' && user.odbor === odborId);
        if (!canWrite) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
        }

        const updates = {};
        
        if (newName) {
            updates[`${agendaPath}/name`] = newName;
        }
        updates[`${agendaPath}/details`] = updatedAgendaDetails;
        
        // Zpracování vazeb na informační systémy
        for (const systemId of (linksToAdd || [])) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Agendy/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val();
            if (!Array.isArray(links)) links = [];
            if (!links.includes(agendaId)) links.push(agendaId);
            updates[systemLinksPath] = links;
        }

        for (const systemId of (linksToRemove || [])) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Agendy/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val();
            if (!Array.isArray(links)) links = [];
            const filteredLinks = links.filter(id => id !== agendaId);
            updates[systemLinksPath] = filteredLinks.length > 0 ? filteredLinks : "";
        }

        // Zpracování vazeb na regulované služby
        if (serviceLinks) {
            for (const serviceId of (serviceLinks.toAdd || [])) {
                const serviceRelativePath = await findServicePath(serviceId);
                if (serviceRelativePath) {
                     const serviceAgendaLinksPath = `primarni/children/sluzby/children/${serviceRelativePath}/details/Agendy/linksTo`;
                     const snapshot = await db.ref(serviceAgendaLinksPath).once('value');
                     let links = snapshot.val();
                     if (!Array.isArray(links)) links = []; 
                     if (!links.includes(agendaId)) links.push(agendaId);
                     updates[serviceAgendaLinksPath] = links;
                }
            }
            for (const serviceId of (serviceLinks.toRemove || [])) {
                const serviceRelativePath = await findServicePath(serviceId);
                if (serviceRelativePath) {
                     const serviceAgendaLinksPath = `primarni/children/sluzby/children/${serviceRelativePath}/details/Agendy/linksTo`;
                     const snapshot = await db.ref(serviceAgendaLinksPath).once('value');
                     let links = snapshot.val();
                     if (!Array.isArray(links)) links = []; 
                     const filteredLinks = links.filter(id => id !== agendaId);
                     updates[serviceAgendaLinksPath] = filteredLinks.length > 0 ? filteredLinks : ""; 
                }
            }
        }

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