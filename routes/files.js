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


//-----------------------------------------------------------------------------


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


//-----------------------------------------------------------------------------


//Update a file
router.put('/:id', async function(req, res, next) {
	//Not really anything to update but owneruid at the moment, idk
	//Commit takes care of blocksets
	res.send("Stub");
});


//-----------------------------------------------------------------------------


//Update a blockset
router.put('/commit/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	const body = req.body;
	console.log(`\nCOMMIT FILE called with fileUID='${fileUID}'`);

	
	var fileBlocks = [];
	try {
		fileBlocks = JSON.parse(body.fileblocks);
		if(!Array.isArray(fileBlocks)) throw new Error('fileblocks is not an array!');
	} catch (err) {
		console.log(`File commit request must contain a JSON array of fileblocks!`);
		return res.status(422).send({ message: `File commit request must contain a JSON array of fileblocks!` });
	}

	
	(async () => {
		const client = await POOL.connect();
		try {

			var fileSize = 0;
			if(fileBlocks.length > 0) {
				//Check that all blocks exist
				var getblockssql = 
				`SELECT blockhash, blocksize FROM block 
				WHERE blockhash IN ('${fileBlocks.join("', '")}');`;

				console.log(`Fetching existing blocks with sql -`);
				console.log(getblockssql.replaceAll("\t","").replaceAll("\n", " "));
				var {rows} = await client.query(getblockssql);


				var existingBlocks = rows.map(block => block.blockhash);
				fileSize = rows.reduce((sum, block) => sum + block.blocksize, 0)
				let missingblocks = fileBlocks.filter(block => !existingBlocks.includes(block));

				console.log(`Blocks:  [${fileBlocks}]`);
				console.log(`Missing: [${missingblocks}]`);


				//If we don't have all the blocks, notify the client of the ones that are missing
				if(missingblocks.length > 0) {
					res.status(400).send({ message: `Cannot commit, blocks are missing!`, "missingblocks":missingblocks})
					return;
				}
			}

			

			//Otherwise, we are ok-ed to update the file's blockset
			var updateblocksetsql = 
			`UPDATE file SET fileblocks = '{${fileBlocks.map(block => `"${block}"`).join(`, `)}}',
			filesize = ${fileSize}
			WHERE fileuid = '${fileUID}';`

			console.log(`Updating fileblocks with sql -`);
			console.log(updateblocksetsql.replaceAll("\t","").replaceAll("\n", " "));
			
			var {rowCount} = await client.query(updateblocksetsql);


			if(rowCount == 0)
				res.sendStatus(404);
			else
				res.sendStatus(200);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


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




module.exports = router;