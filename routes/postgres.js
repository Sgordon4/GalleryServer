var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool")


router.get('/', function(req, res, next) {
    // res.send('Postgres output -');

    (async () => {
        const client = await POOL.connect();
  
        try {
            const {rows} = await client.query('SELECT * FROM account;');
            console.log("ROWS: ");
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
  