var express = require('express');
const { body, param, matchedData, validationResult } = require('express-validator');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');
const { time } = require('console');



const journalFields = ["journalid", "fileuid", "accountuid", "changes", "changetime"]



//This function is pretty subpar, I just kind of threw it together. Definitely needs a touch-up.
const sleepTime = 5 * 1000;
router.get('/longpoll/:startid', function(req, res, next) {
	const startID = req.params.startid;
	var accountUIDs = req.query.accountuid;


	//If multiple accounts were sent as query params, combine them into one string
	if(Array.isArray( accountUIDs )) 
		accountUIDs = accountUIDs.join("', '");

	console.log(`\nLONGPOLL JOURNAL called after JID='${startID}' for accounts='${accountUIDs}'`);


		
	//Only include the account where clause if there are any accounts sent over in query params
	const accSql = "";
	if(accountUIDs != null)
		accSql = ` AND accountuid in ('${accountUIDs}')`;


	//Dont actually know if this works
	const sql =
	`SELECT DISTINCT ON (fileuid) 
	journalid, fileuid, accountuid, filehash, attrhash, changetime 
	FROM journal WHERE journalid > '${startID}'${accSql}
	ORDER BY fileuid DESC;`;
	


	(async () => {
		//Try to get new data from the Journal 6 times
		var tries = 6;
		do {
			const client = await POOL.connect();

			try {
				console.log("Polling...");
				try {
					//console.log(`Longpoll checking journal for new entries -`);
					//console.log(sql.replaceAll("\t","").replaceAll("\n", " "));


					const {rows} = await client.query(sql);
	
	
					//If we got new data back from the query, return it
					if(rows.length != 0) {
						console.log("New data found!")
						res.send(rows);
						return;		//And don't do anything else
					}
				}
				finally { client.release(); }

				tries--;

				//If we got here, we didn't get any data back from the journal query. Sleep and then try again
				if(tries > 0) 
					await sleep(sleepTime);


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




const journalIDCheck = () => param('journalid').isInt({min: 0}).withMessage("Must be a number, >= 0!");
const accountUIDCheck = () => body('accountuid').isUUID().withMessage("Must be a UUID!");
const fileUIDsCheck = () => body('fileuid').toArray().isUUID().withMessage("Must be a UUID!");
const deviceUIDCheck = () => body('deviceuid').isUUID().withMessage("Must be a UUID!");


const contentValidations = [journalIDCheck(), accountUIDCheck(), fileUIDsCheck(), deviceUIDCheck()]

//Get the journal entries after journalID for the provided fields
router.get('/:journalid', contentValidations, function(req, res, next) {
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot get journals!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}
	const data = matchedData(req);
	console.log(`\nGET ALL JOURNAL FOR called with start='${data.journalid}', accountuid='${data.accountuid}'`);

	console.log(data);

	//TODO Fix this, loop or map or whatever
	var fileWhere = (data.fileuid.length == 0) ? "" : `AND fileuid in (${data.fileuid}) `;


	var sql = `SELECT journalid, fileuid, accountuid, changes, changetime FROM journal `;
	sql += `WHERE journalid > '${data.journalid}' AND accountuid = '${data.accountuid}' ${fileWhere}AND deviceuid != '${data.deviceuid}';`;

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
router.get('/file/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET JOURNAL BY FILEUID called with fileUID='${fileUID}'`);


	var sql =
	`SELECT journalid, fileuid, accountuid, filehash, attrhash, changetime 
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