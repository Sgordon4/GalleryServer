var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



//Get a presigned GET url to access the block itself
router.get('/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nGET BLOCK called with hash='${blockHash}'`);

	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		//Key: "smiley.png", 
		Expires: 120 //seconds 
	})
	.then(url => {
		console.log(`Signed block get url generated: \n${url}`);
		res.redirect(url);
	});
});


//-----------------------------------------------------------------------------

//Get a presigned PUT url to upload the block itself
router.get('upload/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nPUT BLOCK called with hash='${blockHash}'`);

	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		Expires: 360 //seconds 
	})
	.then(url => {
		console.log(`Signed block put url generated: \n${url}`);
		res.send(url);
		next();
	});
});


//-----------------------------------------------------------------------------

//Delete the block
router.delete('/:hash', function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nDELETE BLOCK called with hash='${blockHash}'`);

	(async () => {
		try {
			console.log(`Deleting object from IBM COS...`);
			IBMCOS.deleteObject({	//sets delete marker
				Bucket: IBMCOSBucket,
				Key: blockHash
			}).promise()
			.then(() => {
				console.log(`Deleted hash='${blockHash}'`);
				res.sendStatus(200);
			});
		} 
		catch (e) {
			console.error(`Error deleting hash='${blockHash}': \n${e.code} - ${e.message}\n`);
			res.send(e);
			//res.sendStatus(404);
		}
	})();
});



module.exports = router;