// netlify/functions/update-agenda.js
const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
// Ujistěte se, že proměnné prostředí jsou v Netlify správně nastaveny
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

// Funkce pro nalezení cesty k regulované službě
async function findServicePath(serviceId) {
    const sluzbyRef = db.ref('primarni/children/sluzby/children');
    const snapshot = await sluzbyRef.once('value');
    const serviceCategories = snapshot.val();
    
    if (!serviceCategories) return null;

    for (const categoryId in serviceCategories) {
        const category = serviceCategories[categoryId];
        if (category.children && category.children[serviceId]) {
            return `${categoryId}/children/${serviceId}`;
        }
    }
    return null;
}


exports.handler = async function(event, context) {
    // 1. CORS hlavičky pro povolení přístupu z externích nástrojů
    const headers = {
        'Access-Control-Allow-Origin': '*', // Povolit všechny domény (pro vývoj/nástroje bezpečné, pokud je vyžadován token)
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 2. Rychlá odpověď na preflight request (OPTIONS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: 'Method Not Allowed' 
        };
    }

    // 3. Ověření uživatele
    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) {
        // Přidáme CORS hlavičky i k chybové odpovědi autentizace
        return { ...error, headers };
    }

    try {
        const { agendaPath, newName, updatedAgendaDetails, linksToAdd, linksToRemove, serviceLinks, agendaId } = JSON.parse(event.body);
        
        // Získání ID odboru z cesty (očekávaný formát: agendy/children/{odborId}/children/{agendaId})
        const odborId = agendaPath.split('/')[2];
        if (!odborId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Bad Request: Invalid agenda path.' }) 
            };
        }

        // 4. Kontrola oprávnění (Admin nebo Garant daného odboru)
        const canWrite = user.role === 'administrator' || (user.role === 'garant' && user.odbor === odborId);
        if (!canWrite) {
            return { 
                statusCode: 403, 
                headers, 
                body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) 
            };
        }

        const updates = {};
        
        // Aktualizace samotné agendy
        if (newName) {
            updates[`${agendaPath}/name`] = newName;
        }
        // Pokud přišly detaily, aktualizujeme je (důležité pro HTML nástroj, který posílá kompletní structure)
        if (updatedAgendaDetails) {
            updates[`${agendaPath}/details`] = updatedAgendaDetails;
        }
        
        // 5. Zpracování vazeb na Informační systémy (Přidání)
        for (const systemId of (linksToAdd || [])) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Agendy/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val();
            if (!Array.isArray(links)) links = [];
            
            // Přidat pouze pokud tam ještě není
            if (!links.includes(agendaId)) {
                links.push(agendaId);
                updates[systemLinksPath] = links;
            }
        }

        // 6. Zpracování vazeb na Informační systémy (Odebrání)
        for (const systemId of (linksToRemove || [])) {
            const systemLinksPath = `primarni/children/informacni-systemy/children/${systemId}/details/Agendy/linksTo`;
            const snapshot = await db.ref(systemLinksPath).once('value');
            let links = snapshot.val();
            if (!Array.isArray(links)) links = [];
            
            const filteredLinks = links.filter(id => id !== agendaId);
            // Pokud se pole změnilo, zapíšeme ho. Prázdné pole nahradíme prázdným řetězcem nebo null, dle konvence
            updates[systemLinksPath] = filteredLinks.length > 0 ? filteredLinks : "";
        }

        // 7. Zpracování vazeb na Regulované služby
        if (serviceLinks) {
            // Přidání
            for (const serviceId of (serviceLinks.toAdd || [])) {
                const serviceRelativePath = await findServicePath(serviceId);
                if (serviceRelativePath) {
                     const serviceAgendaLinksPath = `primarni/children/sluzby/children/${serviceRelativePath}/details/Agendy/linksTo`;
                     const snapshot = await db.ref(serviceAgendaLinksPath).once('value');
                     let links = snapshot.val();
                     if (!Array.isArray(links)) links = []; 
                     if (!links.includes(agendaId)) {
                         links.push(agendaId);
                         updates[serviceAgendaLinksPath] = links;
                     }
                }
            }
            // Odebrání
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

        // 8. Atomický zápis všech změn
        await db.ref().update(updates);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true }),
        };
    } catch (err) {
        console.error("Chyba při aktualizaci agendy a vazeb:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update agenda.' }),
        };
    }
};