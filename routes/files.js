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
			const {rows} = await client.query("SELECT EXISTS"
				+"(SELECT 1 FROM file WHERE fileuid = '"+fileUID+"');");
			console.log("Files queried!");

			res.send('File info for id: ' + req.params.id
				+"<br>File exists: "+rows[0].exists);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});


//-----------------------------------------------------------------------------
// Post Requests
//-----------------------------------------------------------------------------

//Create a new file
//Returns the new file's UID
router.post('/', function(req, res, next) {
	const body = req.body;

	//Check that we have everything we need to create a new file
	const requiredProps = ["accountuid", "filename", "parentuid", "filetype"]
	const hasAllKeys = requiredProps.every(prop => Object.prototype.hasOwnProperty.call(body, prop));

	//If we don't have all the required parameters...
	if(!hasAllKeys) {
		return res.status(422).send({
			message: 'Post request must contain accountuid, filename, parentuid, and filetype'
		});
	}


	(async () => {
		const client = await POOL.connect();
	
		try {
			//Insert a new file with a random UID, using the parameters from 'body'. Return the UID.
			const sql = "insert into file(fileuid, accountuid, filename, parentuid, uri, filetype, "
				+"creationdate, lastaccessdate, lastupdatedate)"
				+"values (gen_random_uuid (), '"+body.accountuid+"', '"+body.filename+"', "
				+body.parentuid+", null, '"+body.filetype+"', (now() at time zone 'utc'), null, null) "
				+"returning fileuid;";
			const {rows} = await client.query(sql);

			console.log("File created!");
			console.log(body);
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


module.exports = router;
