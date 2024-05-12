var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');


/*
Notes: 

Do we want to exlude deleted files?
Thinking about trashed files, we could simply put a trashedtime in the ordering and that would suffice,
Wait yeah that's it. If two dirs ref one fileuid, and one trashes it, we can't just delete it. 
*/




//Get the file properties
router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileUID='${fileUID}'`);


	var sql =
	`SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, 
	changetime, accesstime, modifytime, createtime FROM file
	WHERE fileuid = '${fileUID}'
	AND deletetime is null;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching file properties with sql -`);
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.send(rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});

//Create a new file
router.post('/', async function(req, res, next) {
	console.log(`\nCREATE FILE called`);

	const body = req.body;
	if(!body.owneruid) {
		console.log(`File create request must contain owneruid!`);
		return res.status(422).send({ message: `File create request must contain owneruid!` });
	}


	//Grab the properties we care about
	const usefulProps = ["owneruid", "isdir", "islink"];

	var propHelper = [];
	var valueHelper = [];
	for(const [key, val] of Object.entries(body)) {
		if(val && usefulProps.includes(key)) {
			propHelper.push(key);
			valueHelper.push(`'${val}'`);
		}
	}

	
	const sql = 
	`WITH fileupdate AS
	(
		INSERT INTO file (${propHelper.join(", ")})
		VALUES (${valueHelper.join(", ")})
		RETURNING *
	),
	journalupdate AS (
		INSERT INTO journal
		(fileuid, owneruid, filesize, fileblocks)
		SELECT fileuid, owneruid, filesize, fileblocks
		FROM fileupdate
	)
	SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, createtime FROM fileupdate;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating new file with sql -");
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
});

//Update a file
router.put('/:id', async function(req, res, next) {
	res.send("Stub");
});

//Delete a file (sets delete time, job picks it up later)
router.delete('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nDELETE FILE called with fileUID='${fileUID}'`);


	const sql = 
	`WITH fileupdate AS
	(
		UPDATE file
		SET deletetime = (now() at time zone 'utc')
		WHERE fileuid = '${fileUID}'
		RETURNING *
	),
	journalupdate AS (
		INSERT INTO journal
		(fileuid, owneruid, filesize, fileblocks)
		SELECT fileuid, owneruid, filesize, fileblocks
		FROM fileupdate
	)
	SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, createtime FROM fileupdate;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Deleting file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			await client.query(sql);			
			res.sendStatus(200);
		} 
		catch (err) {
			console.error(`Error deleting file: ${err.code} - ${err.message}\n`);
			res.send(err);
			//res.sendStatus(404);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


//TODO THIS DOESN'T WORK, we need to compile blocks on the client side or whatever
//Get the file url
router.get('/url/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE URL called with fileuid='${fileUID}'`);


	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		Key: fileUID, 
		//Key: "smiley.png", 
		Expires: 120 //seconds	//Prob want this longer, maybe just use default 15min
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.redirect(url);
	});
});

//Update a blockset
router.put('/commit/:hash', async function(req, res, next) {
	const blockHash = req.params.hash;
	console.log(`\nPUT BLOCK called with hash='${blockHash}'`);

	//Check that all blocks exist


	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching file properties with sql -`);
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.send(rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();



	
});



/*


	//If the block already exists, don't allow reupload
	var sql = 
	`SELECT EXISTS (
		SELECT 1 FROM file 
		WHERE fileuid = '5b600697-2065-4266-ac9d-43deb8e9ba20'
	);`;

	//Get a presigned PUT url to upload to the block
	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: fileUID, 
		Expires: 60 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.send(url);
	});
*/







//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------








//Get the file properties for the provided ID
router.get('/properties/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileUID='${fileUID}'`);


	var sql ="SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, "
			+"createtime, accesstime, changetime, modifytime FROM file "
			+"WHERE fileuid = '"+fileUID+"' "
			+"AND deletetime == null;";

	(async () => {
		try {
			const client = await POOL.connect();
			console.log(`Fetching file properties with sql:\n${sql}`);
			const {rows} = await client.query(sql);
			client.release();


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.send(rows[0]);
		} 
		catch (err) {
			client.release();
			console.error(err);
			res.send(err);
		}
	})();
});


//-----------------------------------------------------------------------------

//Attempt to update file
router.put('/:id', async function(req, res, next) {
	const fileUID = req.params.id;	
	const body = req.body;
	console.log(`\nPUT FILE called with fileUID='${fileUID}'`);

	//Filter the recieved properties down to the ones we care about
	const allProps = ["owneruid", "fileblocks"]
	var receivedProps = Object.keys(body);
	receivedProps = receivedProps.filter(prop => allProps.includes(prop));

	//Grab all the values sent over for the properties we care about
	var receivedVals = [];
	for(const prop of receivedProps) 
		receivedVals.push(body[prop]);


	var props = receivedProps.join(", ");
	var vals = receivedVals.map(prop => {
		return (prop != 'null') ? `'${prop}'` : prop;
	}).join(", ");


	if(receivedProps.contains("fileblocks")) {
		const blockSql = `select blockhash from block `
		+`where blockhash in (${fileblocks});`;
	}
	
	/*
	const sql = `update file set (${props}, creationdate) `
	+`values (${vals}, (now() at time zone 'utc')) `
	+`where fileuid = ${fileUID};`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Putting file with sql -");
			console.log(sql);
			
			var ret = await client.query(sql);
			client.release();
			res.send(ret);
		} 
		catch (err) {
			client.release();
			console.error(err);
			res.send(err);
		}
	})();
	*/
});


//-----------------------------------------------------------------------------

//Attempt to create a new file
router.put('/new/:id', async function(req, res, next) {
	const fileUID = req.params.id;	
	const body = req.body;
	console.log(`\nPUT NEW FILE called with fileUID='${fileUID}'`);

	const allProps = ["fileuid", "owneruid", "isdir", "islink"]
	const requiredProps = ["fileuid", "owneruid"]


	//Filter the recieved properties down to the ones we care about
	var receivedProps = Object.keys(body);
	receivedProps = receivedProps.filter(prop => allProps.includes(prop));

	//Grab all the values sent over for the properties we care about
	var receivedVals = [];
	for(const prop of receivedProps) 
		receivedVals.push(body[prop]);



	//If receivedProps doesn't have all the required parameters...
	if(!requiredProps.every(prop => receivedProps.includes(prop))) {
		console.log(`File put request must contain all of [${requiredProps}]`);
		return res.status(422).send({
			message: `File put request must contain all of [${requiredProps}]`
		});
	}
	//Check to make sure no weird shit is going on with fileUID
	if(fileUID != body.fileuid) {
		console.log("File put request fileUIDs must match")
		return res.status(422).send({
			message: 'File put request fileUIDs must match'
		});
	}



	var props = receivedProps.join(", ");
	var vals = receivedVals.map(prop => {
		return (prop != 'null') ? `'${prop}'` : prop;
	}).join(", ");

	
	const sql = `insert into file (${props}, creationdate) `
	+`values (${vals}, (now() at time zone 'utc')) `
	+`on conflict (fileuid) do nothing;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating new file with sql -");
			console.log(sql);
			
			var ret = await client.query(sql);
			client.release();
			res.send(ret);
		} 
		catch (err) {
			client.release();
			console.error(err);
			res.send(err);
		}
	})();
});


//-----------------------------------------------------------------------------

//Attempt to delete file (sets delete time, job picks it up later)
router.delete('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nDELETE FILE called with fileUID='${fileUID}'`);

	(async () => {
	  const client = await POOL.connect();
		try {
			//Get the file data's location
			const sql = `UPDATE file SET deletetime = (now() at time zone 'utc') `
			+`WHERE fileuid='${fileUID}'`;

			console.log(`Setting file delete time with sql:\n${sql}`);
			await client.query(sql);
			client.release();

			res.sendStatus(200);
		} 
		catch (e) {
			client.release();
			console.error(`Error deleting file: ${e.code} - ${e.message}\n`);
			res.send(e);
			//res.sendStatus(404);
		}
	})();
});





module.exports = router;