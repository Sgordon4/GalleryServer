var express = require('express');
var router = express.Router();
var path = require('path');

const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



//---------------------------------------------------------------------------------------------
// Data
//---------------------------------------------------------------------------------------------

//Get a presigned GET url to access the content
router.get('/downloadurl/:key', async function(req, res, next) {
	const key = req.params.key;
	console.log(`\nCREATE CONTENT DOWNLOAD URL called with key='${key}'`);

	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		Key: key, 
		Expires: 1800 //seconds 
	})
	.then(url => {
		console.log(`Signed content get url generated: \n${url}`);
		res.send(url);
	})
	.catch((err) => {
		console.error(`Error generating download url with key='${key}': \n${err.code} - ${err.message}\n`);
		res.status(400).send(`${err.code} - ${err.message}`);
	});
});



//Get a presigned PUT url to upload the content itself
router.get('/uploadurl/:key', async function(req, res, next) {
	const key = req.params.key;
	console.log(`\nCREATE CONTENT UPLOAD URL called with key='${key}'`);

	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: key, 
		Expires: 120 //seconds 
	})
	.then(url => {
		console.log(`Signed content put url generated: \n${url}`);
		res.send(url);		
	})
	.catch((err) => {
		console.error(`Error generating upload url with key='${key}': \n${err.code} - ${err.message}\n`);
		res.status(400).send(`${err.code} - ${err.message}`);
	});
});


//Delete the content itself
router.delete('/:name', function(req, res, next) {
	const name = req.params.name;
	console.log(`\nDELETE CONTENTS called with name='${name}'`);

	console.log(`Deleting object from IBM COS...`);
	IBMCOS.deleteObject({	//IBM sets a delete marker
		Bucket: IBMCOSBucket,
		Key: name
	}).promise()
	.then(() => {
		console.log(`Deleted hash='${name}'`);
		res.sendStatus(200);
	})
	.catch((err) => {
		console.error(`Error deleting hash='${name}': \n${err.code} - ${err.message}\n`);
		res.status(400).send(`${err.code} - ${err.message}`);
	});
});


module.exports = router;