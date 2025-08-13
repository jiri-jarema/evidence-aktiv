// netlify/functions/get-users.js
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

exports.handler = async function(event, context) {
    const { authorization } = event.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        return { statusCode: 401, body: 'Unauthorized: Invalid token' };
    }

    const requesterUid = decodedToken.uid;
    const requesterSnapshot = await db.ref(`users/${requesterUid}`).once('value');
    const requesterData = requesterSnapshot.val();

    if (!requesterData || requesterData.role !== 'administrator') {
        return { statusCode: 403, body: 'Forbidden: Administrator role required.' };
    }

    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const usersFromDbSnapshot = await db.ref('users').once('value');
        const usersFromDb = usersFromDbSnapshot.val() || {};

        const users = listUsersResult.users.map(userRecord => {
            const dbInfo = usersFromDb[userRecord.uid] || {};
            return {
                uid: userRecord.uid,
                email: userRecord.email,
                role: dbInfo.role || 'user',
                odbor: dbInfo.odbor || null,
            };
        });

        return {
            statusCode: 200,
            body: JSON.stringify(users),
        };
    } catch (error) {
        console.error("Error listing users:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to list users.' }),
        };
    }
};
