/*
https://www.youtube.com/watch?v=pKd0Rpw7O48
https://www.w3.org/Provider/Style/URI.html
https://express-validator.github.io/docs/
*/

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const Joi = require('joi');
const http = require('http');
const https = require('https');
const fs = require('fs');
const privateKey = fs.readFileSync(path.join(__dirname, 'certs/localhost.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'certs/localhost.crt'), 'utf8');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



var indexRouter = require('./routes/index');
var usersRouter = require('./routes/accounts');
//var metadataRouter = require('./routes/metadata');
var filesRouter = require('./routes/files');
var journalRouter = require('./routes/journal');
var contentPropsRouter = require('./routes/contentProps');
var contentDataRouter = require('./routes/content');
var contentDataMultipartRouter = require('./routes/multipart');

app.use('/', indexRouter);
app.use('/accounts', usersRouter);
//app.use('/files/metadata', metadataRouter);
app.use('/files', filesRouter);
app.use('/journal', journalRouter);
app.use('/content', contentPropsRouter);
app.use('/content/data', contentDataRouter);
app.use('/content/data/multipart', contentDataMultipartRouter);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});


module.exports = app;

const credentials = {
	key: privateKey,
	cert: certificate,
  };

const port = process.env.port || 3000 
//app.listen(port, () => console.log(`Listening on port ${port}...`))
http.createServer(credentials, app).listen(port);
