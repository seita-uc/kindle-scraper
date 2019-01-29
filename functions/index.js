const functions = require('firebase-functions');
const admin = require('firebase-admin');
const settings = {timestampsInSnapshots: true};
const serviceAccount = functions.config().account.cert;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
admin.firestore().settings(settings);
const db = admin.firestore()

exports.evernoteAuth = functions.https.onRequest((req, res) => {
    const params = req.query;
    if (!params.hasOwnProperty('oauth_token')) {
        params['oauth_token'] = 'not provided';
    }
    return db.collection('auth').doc('evernote')
        .update({
            oauth_token: params['oauth_token'],
            oauth_verifier: params['oauth_verifier'],
            sandbox_lnb: params['sandbox_lnb']
        })
        .then(() => {
            console.log("Document written!: ", req.query);
            return res.send("Evernote auth successfully executed");
        })
        .catch((err) => {
            console.error("Error adding document: ", err);
            return res.send("Error adding document: ", err);
        });
});

exports.ogp = functions.https.onRequest((req, res) => {
    const parser = require("ogp-parser");
    const params = req.query;
    const chacheControl = 'public, max-age=31557600, s-maxage=31557600';
    if (!params.hasOwnProperty('url')) {
        console.error("Error getting ogp data: please provide url");
        return res.json({ error: "Error getting ogp data: please provide url" });
    }
    return parser(params['url'], false)
        .then((ogpData) => {
            console.log(ogpData);
            return res.set('Cache-Control', chacheControl).json(ogpData);
        })
        .catch((err) => {
            console.error(err);
            return res.json({ error: "Error getting ogp data:" + err });
        });
});

