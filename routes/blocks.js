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
router.get('/upload/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nPUT BLOCK URL called with hash='${blockHash}'`);

	const body = req.body;
	if(!body.blocksize) {
		console.log(`Block put request must contain blocksize!`);
		return res.status(422).send({ message: `Block put request must contain blocksize!` });
	}


	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: blockHash, 
		Expires: 60 //seconds 
	})
	.then(url => {
		console.log(`Signed block put url generated: \n${url}`);

		(async () => {
			await putBlock(blockHash, body.blocksize, res);

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
		console.log(`File create request must contain blocksize!`);
		return res.status(422).send({ message: `File create request must contain blocksize!` });
	}

	
	putBlock(blockHash, body.blocksize, res);
});

//Later this will be triggered by a function on the cloud's end using put(/:hash)
async function putBlock(blockHash, blocksize, res) {
	const sql = 
	`INSERT INTO block (blockhash, blocksize)
	VALUES ('${blockHash}', '${blocksize}')
	ON CONFLICT (blockhash) DO UPDATE 
	SET blocksize = excluded.blocksize, createtime = (now() at time zone 'utc');`;

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