// netlify/functions/get-data.js
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.database();

exports.handler = async function(event, context) {
    try {
        const ref = db.ref('/');
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data.' }),
        };
    }
};