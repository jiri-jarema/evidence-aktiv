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

// Opravená funkce pro rekurzivní nalezení cesty k agendě
async function findAgendaPath(agendaId) {
    const agendyRef = db.ref('agendy');
    const snapshot = await agendyRef.once('value');
    const data = snapshot.val();
    
    function search(currentPath, currentNode) {
        if (!currentNode) return null;
        for (const key in currentNode) {
            const newPath = currentPath ? `${currentPath}/${key}` : key;
            if (key === agendaId) {
                return newPath;
            }
            if (typeof currentNode[key] === 'object' && currentNode[key] && currentNode[key].children) {
                const result = search(`${newPath}/children`, currentNode[key].children);
                if (result) return result;
            }
        }
        return null;
    }
    
    const resultPath = search('children', data.children);
    return resultPath ? `agendy/${resultPath}` : null;
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
        const { assetPath, newName, updatedDetails, reciprocalLinks } = JSON.parse(event.body);
        
        const updates = {};
        
        if (newName) {
            updates[`${assetPath}/name`] = newName;
        }
        updates[`${assetPath}/details`] = updatedDetails;

        if (reciprocalLinks) {
            // Stávající logika pro informační systémy, servery atd.
            for (const link of (reciprocalLinks.toAdd || [])) {
                const { targetPath, sourceId } = link;
                const snapshot = await db.ref(targetPath).once('value');
                let links = snapshot.val();
                if (!Array.isArray(links)) links = [];
                if (!links.includes(sourceId)) {
                    links.push(sourceId);
                }
                updates[targetPath] = links;
            }

            for (const link of (reciprocalLinks.toRemove || [])) {
                const { targetPath, sourceId } = link;
                const snapshot = await db.ref(targetPath).once('value');
                let links = snapshot.val();
                if (!Array.isArray(links)) links = [];
                const filteredLinks = links.filter(id => id !== sourceId);
                updates[targetPath] = filteredLinks.length > 0 ? filteredLinks : "";
            }

            // Opravená logika pro vazby Služba -> Agenda
            for (const agendaId of (reciprocalLinks.agendasToAdd || [])) {
                 const targetAgendaPath = await findAgendaPath(agendaId);
                 if (targetAgendaPath) {
                     const agendaServiceLinksPath = `${targetAgendaPath}/details/Regulované služby/linksTo`;
                     const snapshot = await db.ref(agendaServiceLinksPath).once('value');
                     let links = snapshot.val();
                     if (!Array.isArray(links)) links = [];
                     if (!links.includes(reciprocalLinks.sourceId)) links.push(reciprocalLinks.sourceId);
                     updates[agendaServiceLinksPath] = links;
                 }
            }
             for (const agendaId of (reciprocalLinks.agendasToRemove || [])) {
                 const targetAgendaPath = await findAgendaPath(agendaId);
                 if (targetAgendaPath) {
                     const agendaServiceLinksPath = `${targetAgendaPath}/details/Regulované služby/linksTo`;
                     const snapshot = await db.ref(agendaServiceLinksPath).once('value');
                     let links = snapshot.val() || [];
                     if (!Array.isArray(links)) links = [];
                     const filteredLinks = links.filter(id => id !== reciprocalLinks.sourceId);
                     updates[agendaServiceLinksPath] = filteredLinks.length > 0 ? filteredLinks : "";
                 }
            }
        }

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