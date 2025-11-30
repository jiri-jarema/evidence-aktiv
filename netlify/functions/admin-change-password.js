const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK (pokud ještě není)
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

// Pomocná funkce pro ověření role administrátora
async function verifyAdminRole(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) throw new Error('Missing Authorization header');
  
  const decoded = await admin.auth().verifyIdToken(idToken);
  const uid = decoded.uid;
  
  // Kontrola role v databázi
  const snap = await admin.database().ref(`/users/${uid}`).once('value');
  const data = snap.val() || {};
  
  if (data.role !== 'administrator') {
      const err = new Error('Insufficient permissions');
      err.statusCode = 403;
      throw err;
  }
  return { uid };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Ověření oprávnění
    await verifyAdminRole(event);

    // 2. Získání dat z požadavku
    const { uid, newPassword } = JSON.parse(event.body || '{}');

    if (!uid || !newPassword) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing uid or newPassword' }) };
    }
    
    if (newPassword.length < 6) {
         return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 6 characters' }) };
    }

    // 3. Změna hesla pomocí Admin SDK
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Password updated successfully' })
    };

  } catch (err) {
    console.error('Error changing password:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};