var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');


/*
Note: IBM Cloud Engine triggers have not been set up yet, so the cos can't call this api to tell
us that an object has been uploaded. Therefore, we're going to pretend it is for the time being.
https://cloud.ibm.com/docs/codeengine
*/



//Get block properties
router.get('/props', async function(req, res, next) {
	var blockHashes = req.query.blockhash;
	console.log(`\nGET BLOCK PROPS called with blockhashes='${blockHashes}'`);

	
	if(blockHashes.length < 1) {
		console.log(`No blocks to retrieve!`);
		var errJson = `{"status" : "fail", `
			+`"data" : {"blockhash" : "Block properties get request must contain 1 or more blockhash!"}}`
		console.log(errJson);
		return res.status(422).send(errJson);
	}
 
	if(Array.isArray( blockHashes ))
		blockHashes = blockHashes.join("', '");

	var sql =
	`SELECT blockhash, blocksize, createtime FROM block
	WHERE blockhash in ('${blockHashes}');`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching block properties with sql -`);
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			res.send(rows);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


//Get a presigned GET url to access the get url
router.get('/link/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nGET BLOCK called with hash='${blockHash}'`);

	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		//Key: "smiley.png", 
		Expires: 1200 //seconds 
	})
	.then(url => {
		console.log(`Signed block get url generated: \n${url}`);
		res.send(url);
	});
});


//Get a presigned GET url to access the block itself (redirects instead of just sending)
router.get('/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nGET BLOCK called with hash='${blockHash}'`);

	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		//Key: "smiley.png", 
		Expires: 1200 //seconds 
	})
	.then(url => {
		console.log(`Signed block get url generated: \n${url}`);
		res.redirect(url);
	});
});


//-----------------------------------------------------------------------------


//Get a presigned PUT url to upload the block itself
router.get('/upload/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nPUT BLOCK URL called with hash='${blockHash}'`);

	// const body = req.body;
	// if(!body.blocksize) {
	// 	console.log(`Block put request must contain blocksize!`);
	// 	return res.status(422).send({ message: `Block put request must contain blocksize!` });
	// }
	//When we change to a cloud trigger updating the block table, see if we can't pass blocksize 
	// with the upload url for use with the trigger, since the block will be compressed and encrypted
	// when it ends up at the server so the blocksize will be different.


	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		Expires: 60 //seconds 
	})
	.then(url => {
		console.log(`Signed block put url generated: \n${url}`);

		(async () => {
			//await putBlock(blockHash, body.blocksize, res);

			console.log("Sending url");
			res.send(url);
		})();
		
	});
});


//-----------------------------------------------------------------------------


//Create a block entry
router.put('/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nPUT BLOCK called with hash='${blockHash}'`);

	const body = req.body;
	if(!body.blocksize) {
		console.log(`Block create request must contain blocksize!`);
		return res.status(422).send({ message: `Block create request must contain blocksize!` });
	}

	
	putBlock(blockHash, body.blocksize, res);
});

//Later this will be triggered by a function on the cloud's end using put(/:hash)
async function putBlock(blockHash, blocksize, res) {
	const sql = 
	`INSERT INTO block (blockhash, blocksize)
	VALUES ('${blockHash}', '${blocksize}')
	ON CONFLICT (blockhash) DO UPDATE 
	SET blocksize = excluded.blocksize, createtime = extract(epoch from date_trunc('second', (now() at time zone 'utc')));`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating block entry with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
}


//-----------------------------------------------------------------------------

//Delete the block
router.delete('/:hash', function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nDELETE BLOCK called with hash='${blockHash}'`);


	const sql = 
	`DELETE FROM block
	WHERE blockhash = '${blockHash}';`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Deleting block entry with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			await client.query(sql);


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
		catch (err) {
			console.error(`Error deleting hash='${blockHash}': \n${err.code} - ${err.message}\n`);
			res.send(err);
		}
		finally { client.release(); }
	})();
});



module.exports = router;