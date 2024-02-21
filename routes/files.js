var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");


/*
Planned API structure:

Return list of files for a given account/parent file. Need to include scaling (max 100, etc)
../files?account&parentUID&...

Return contents of file
../files/fileUID


Return list of metadata of files for a given account/parent file. Need to include scaling (max 100, etc)
../files/metadata?account&parentUID&...

Return metadata of file
../files/metadata/fileUID
*/


//-----------------------------------------------------------------------------
// Get Requests
//-----------------------------------------------------------------------------

router.get('/', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	(async () => {
	  const client = await POOL.connect();

		try {
			const {rows} = await client.query('SELECT * FROM file;');
			console.log("Files queried!");

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});



router.get('/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	(async () => {
	  const client = await POOL.connect();
		try {
			const datesql = "update metadata "
			+"set lasttableaccessdate = (now() at time zone 'utc') "
			+"where fileuid = '"+fileUID+"';";
			client.query(datesql);		//TODO does this block? Can't remember
			console.log("lasttableaccessdate has been updated.");


			const sql = "select uri from file "
				+"where fileuid = '"+fileUID+"';";
			const {rows} = await client.query(sql);
			
			console.log("Selecting file with sql -");
			console.log(sql);

			//Send the retreived data
			console.log(rows[0]);
			res.send(rows[0]);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});


//-----------------------------------------------------------------------------
// Create Requests
//-----------------------------------------------------------------------------

//Create a new file
//Returns the new file's UID
router.put('/', function(req, res, next) {
	const body = req.body;

	//Check that we have everything we need to create a new file
	const requiredProps = ["accountuid", "filename", "parentuid", "filetype"]
	const hasAllKeys = requiredProps.every(prop => Object.prototype.hasOwnProperty.call(body, prop));

	//If we don't have all the required parameters...
	if(!hasAllKeys) {
		return res.status(422).send({
			message: 'New file request must contain all of [accountuid, filename, parentuid, and filetype]'
		});
	}


	(async () => {
		const client = await POOL.connect();
	
		//TODO: Only returns ID when file is actually created, not on duplicate create requests.
		//See https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql
		try {
			//Insert a new file with a random UID, using the parameters from 'body'. Return the UID.
			const sql = "insert into file(fileuid, accountuid, filename, parentuid, filetype, creationdate) "
				+"values (gen_random_uuid (), '"+body.accountuid+"', '"+body.filename+"', "
				+body.parentuid+", '"+body.filetype+"', (now() at time zone 'utc')) "
				+"on conflict (accountuid, filename, parentuid) do nothing "
				+"returning fileuid;";
				
			console.log("Creating file with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);

			//Send the retreived data
			console.log(rows);
			res.send(rows);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});


module.exports = router;
