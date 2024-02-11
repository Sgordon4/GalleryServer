var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool")



router.get('/', function(req, res, next) {
    res.send('<h2>Postgres output -</h2>'+
    'Try /accounts, /files, or /metadata');
});

router.get('/accounts', function(req, res, next) {
    (async () => {
        const client = await POOL.connect();
  
        try {
            const {rows} = await client.query('SELECT * FROM account;');
            console.log("ACCOUNTS: ");
            console.log(rows);
            res.send(rows);
        } 
        catch (err) {
            console.error(err);
        } finally {
            client.release();
        }
    })();
});


router.get('/files', function(req, res, next) {
    (async () => {
        const client = await POOL.connect();
  
        try {
            const {rows} = await client.query('SELECT * FROM file;');
            console.log("FILES: ");
            console.log(rows);
            res.send(rows);
        } 
        catch (err) {
            console.error(err);
        } finally {
            client.release();
        }
    })();
});


router.get('/metadata', function(req, res, next) {
    (async () => {
        const client = await POOL.connect();
  
        try {
            const {rows} = await client.query('SELECT * FROM metadata;');
            console.log("METADATA: ");
            console.log(rows);
            res.send(rows);
        } 
        catch (err) {
            console.error(err);
        } finally {
            client.release();
        }
    })();
});
  
module.exports = router;
  