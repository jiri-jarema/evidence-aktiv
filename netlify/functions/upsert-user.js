const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL });
}
async function verifyAdminRole(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) throw new Error('Missing Authorization header');
  const decoded = await admin.auth().verifyIdToken(idToken);
  const uid = decoded.uid;
  const snap = await admin.database().ref(`/users/${uid}`).once('value');
  const data = snap.val() || {};
  if (data.role !== 'administrator') { const err = new Error('Insufficient permissions'); err.statusCode = 403; throw err; }
  return { uid };
}
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
    await verifyAdminRole(event);
    const payload = JSON.parse(event.body || '{}');
    let targetUid = payload.uid;
    if (!targetUid && payload.email) {
      const userRecord = await admin.auth().getUserByEmail(payload.email);
      targetUid = userRecord.uid;
    }
    if (!targetUid) return { statusCode: 400, body: 'Missing uid or email' };
    const update = {};
    if (payload.role) update.role = payload.role;
    if (payload.odbor !== undefined) update.odbor = payload.odbor;
    await admin.database().ref(`/users/${targetUid}`).update(update);
    return { statusCode: 200, body: JSON.stringify({ success: true, uid: targetUid }) };
  } catch (err) { return { statusCode: err.statusCode || 400, body: err.message || 'Bad request' }; }
};