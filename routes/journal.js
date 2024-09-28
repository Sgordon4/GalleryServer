var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');
const { time } = require('console');



const journalFields = ["journalid", "fileuid", "accountuid", 
	"fileblocks", "filehash", "attrhash", "changetime"]



//This function is pretty subpar, I just kind of threw it together. Definitely needs a touch-up.
const sleepTime = 5 * 1000;
router.get('/longpoll/:startid', async function(req, res, next) {
	var startID = req.params.startid;
	var accountUIDs = req.query.accountuid;

	
	//If multiple accounts were sent as quert params, combine them into one string
	if(Array.isArray( accountUIDs )) 
		accountUIDs = accountUIDs.join("', '");

	console.log(`\nLONGPOLL JOURNAL called after JID='${startID}' for accounts='${accountUIDs}'`);

		
	
	//Only include the account where clause if there are any accounts sent over in query params
	var accSql = "";
	if(accountUIDs != null)
		accSql = ` AND accountuid in ('${accountUIDs}')`;


	var sql =
	`SELECT journalid, fileuid, accountuid, fileblocks, filehash, attrhash, changetime 
	FROM journal WHERE journalid > '${startID}'${accSql};`;


	(async () => {
		//Try to get new data from the Journal 6 times
		var tries = 6;
		do {
			const client = await POOL.connect();

			try {
				try {
					console.log(`Longpoll checking journal for new entries -`);
					console.log(sql.replaceAll("\t","").replaceAll("\n", " "));


					const {rows} = await client.query(sql);
	
	
					//If we got new data back from the query, return it
					if(rows.length != 0) {
						console.log("New data found!")
						res.send(rows);
						return;		//And don't do anything else
					}

					console.log("No data received.")
				}
				finally { client.release(); }

				tries--;

				//If we got here, we didn't get any data back from the journal query. Sleep and then try again
				if(tries > 0) {
					console.log("Sleeping!")
					await sleep(sleepTime);
				}


				//If the client aborts the connection, stop things
				if(req.closed)
					return;
			} 
			catch (err) {
				console.error(err);
				return res.send(err);	//Don't continue on error
			}
		} while(tries > 0);


		//Send a timeout response
		res.sendStatus(408);
		console.log("Sent timeout");
	})();
});

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}





//Get the journal entries in a journalID range
router.get('/:startid', async function(req, res, next) {
	const startID = req.params.startid;
	console.log(`\nGET JOURNAL called with start='${startID}'`);


	var sql =
	`SELECT journalid, fileuid, accountuid, fileblocks, filehash, attrhash, changetime 
	FROM journal WHERE journalid > '${startID}';`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching journal entries with sql -`);
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


//Get the journal entries for a specific fileuid
router.get('/file/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET JOURNAL BY FILEUID called with fileUID='${fileUID}'`);


	var sql =
	`SELECT journalid, fileuid, accountuid, fileblocks, filehash, attrhash, changetime 
	FROM journal WHERE fileuid = '${fileUID}';`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching journal entries with sql -`);
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


module.exports = router;