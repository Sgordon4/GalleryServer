var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");

/*
Planned API structure:

Return userdefinedattr for a given account/parent file. Need to include scaling (max 100, etc)
../files/attributes?account&parentUID&...

Return userdefinedattr for a given file uuid.
../files/attributes/fileuid


Return tags for a given account/parent file. Need to include scaling (max 100, etc)
../files/tags?account&parentUID&...

Return tags for a given file uuid.
../files/tags/fileuid

*/




router.get('/', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	(async () => {
		const client = await POOL.connect();
	
		try {
			const {rows} = await client.query('SELECT * FROM metadata;');
			console.log("Metadata queried!");

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
			//Get the metadata for this fileuid
			const sql = "select * from metadata "
				+"where fileuid = '"+fileUID+"';";
			console.log("Geting metadata with sql -");
			console.log(sql);
			const {metadata} = (await client.query(sql))[0];


			//Update lasttableaccessdate
			const datesql = "insert into "
				+"metadata (fileuid, lasttableaccessdate, creationdate) "
				+"values ("+fileUID+", (now() at time zone 'utc'), (now() at time zone 'utc')) "
				+"on conflict (fileuid) DO UPDATE "
				+"SET lasttableaccessdate=EXCLUDED.lasttableaccessdate, "
				+"creationDate=(now() at time zone 'utc');";
			console.log("Updating lasttableaccessdate with sql -");
			console.log(datesql);
			client.query(datesql);	//Don't await, we don't care about the response


			//Send the retreived data
			console.log(metadata);
			res.send(metadata);
		}
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});





//-----------------------------------------------------------------------------
// Update Requests
//-----------------------------------------------------------------------------

//Update file metadata by ID
router.post('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	const body = req.body;

	//Get the intersection of columns available to update and those sent in the request
	const bodyParams = Object.keys(body);
	const availableColumns = ["userdefinedattr", "tags"];
	
	var toUpdate = availableColumns.filter(column => bodyParams.includes(column));
	var updates = toUpdate.map(column => "'"+body[column]+"'");
	

	//If we don't have any of the required parameters...
	if(toUpdate.length <= 0) {
		return res.status(422).send({
			message: 'Metadata update request must contain any of [userdefinedattr, tags]'
		});
	}


	(async () => {
		//Add some syntax to help with the final line of the upsert
		var excludedHelper = toUpdate.map(column => " "+column+"=EXCLUDED."+column);

		const client = await POOL.connect();
		try {
			//Update a file's metadata, using the parameters from 'body'.
			const sql = "insert into "
				+"metadata (fileuid, "+toUpdate.toString()+", lasttableupdatedate, creationdate) "
				+"values ('"+fileUID+"', "+updates.toString()+", "
				+"(now() at time zone 'utc'), (now() at time zone 'utc'))) "
				+"on conflict (fileuid) DO UPDATE "
				+"SET"+excludedHelper.toString()+", lasttableupdatedate=EXCLUDED.lasttableupdatedate, "
				+"creationDate=(now() at time zone 'utc');";

			console.log("Updating metadata with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);
			
			//Send the retreived data
			console.log(rows);
			res.send("Metadata updated!");
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});


module.exports = router;