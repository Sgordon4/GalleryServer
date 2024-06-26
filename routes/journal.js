var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');


//Get the journal entries in a journalID range
router.get('/:startid', async function(req, res, next) {
	const startID = req.params.startid;
	console.log(`\nGET JOURNAL called with start='${startID}'`);


	var sql =
	`SELECT journalid, fileuid, owneruid, filesize, fileblocks, changetime 
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


module.exports = router;