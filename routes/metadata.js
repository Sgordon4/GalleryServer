var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");

/*
Planned API structure:

Return  list of attributes for the provided accounts/parents or 1 fileuid. 
Returns json in the form of accountuid { parentuid { file, file, ... }}.
Each file object includes (fileuid, userdefinedattr).

../files/attributes?account&parentUID&...			Need to include scaling (max 100, etc).
../files/attributes/fileuid


Return  list of tags for the provided accounts/parents or 1 fileuid. 
Returns json in the form of accountuid { parentuid { file, file, ... }}.
Each file object includes (fileuid, tags).

../files/tags?account&parentUID&...					Need to include scaling (max 100, etc).
../files/tags/fileuid

*/

//-----------------------------------------------------------------------------
// Get Attributes
//
// Return attributes for the provided accounts/parents or 1 fileuid. 
// Returns json in the form of accountuid { parentuid { file, file, ... }}.
// Each file object includes (fileuid, userdefinedattr).
//-----------------------------------------------------------------------------


function getFileAttrs(accountuids, parentuids, fileuids) {
	//Build a list of where string conditions out of existing parameters
	var conditions = [];

	//Make sure any existing values are in array form for ease of use with sql's "in"
	var accountuids = accountuids ? [].concat(accountuids) : null;
    var parentuids = parentuids ? [].concat(parentuids) : null;
    var fileuids = fileuids ? [].concat(fileuids) : null;

	//Add existing values to the conditions list
	if(accountuids != null) 
		conditions.push("accountuid in ("+accountuids.toString()+")");
	if(parentuids != null) 
		conditions.push("parentuid in ("+parentuids.toString()+")");
	if(fileuids != null) 
		conditions.push("fileuid in ("+fileuids.toString()+")");
	
	//Combine the conditions into a usable where query
	const where = conditions.length > 0 ? " WHERE "+conditions.join(" AND ") : "";


	(async () => {
		const client = await POOL.connect();
	
		try {
			const sql = "select fileuid, userdefinedattr from file";
			sql += where;
			sql += ";";
			console.log("Geting file attributes with sql -");
			console.log(sql);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();


	
}


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