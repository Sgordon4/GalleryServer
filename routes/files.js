var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('No files yet');
});


router.get('/files', function(req, res, next) {
  //res.render('index', { title: 'Express' });
  res.send('AAAAAAAAAA');
});

module.exports = router;
