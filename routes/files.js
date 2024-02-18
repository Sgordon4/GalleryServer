var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool")



router.get('/', function(req, res, next) {
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


router.get('/files', function(req, res, next) {
    //res.render('index', { title: 'Express' });
    
    console.log(req);
    

    res.send('AAAAAAAAAA');
});

module.exports = router;
