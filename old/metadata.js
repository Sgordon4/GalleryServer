var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");
const { string } = require('joi');

/*
---- WARNING ----
This API is vulnerable to sql injection. It needs to be converted to use postgres parameterization.


Planned API structure:

Return  list of attributes for the provided accounts/parents or 1 fileuid. 
Returns json in the form of accountuid { parentuid { file, file, ... }}.
Each file object includes (fileuid, userdefinedattr).

../files/metadata?account&parentUID&...				Need to include scaling (max 100, etc).
../files/metadata/fileuid


Return  list of tags for the provided accounts/parents or 1 fileuid. 
Returns json in the form of accountuid { parentuid { file, file, ... }}.
Each file object includes (fileuid, tags).

../files/metadata/tags?account&parentUID&...		Need to include scaling (max 100, etc).
../files/metadata/tags/fileuid

*/


//-----------------------------------------------------------------------------
// Get Attributes
//
// Return attributes for the provided accounts/parents or 1 fileuid. 
// Returns json in the form of accountuid { parentuid { file, file, ... }}.
// Each file object includes (fileuid, userdefinedattr).
//-----------------------------------------------------------------------------

router.get('/tags/', function(req, res, next) {
	//Get the parameters from the request
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	//Grab any conditions we care about from the parameters sent with the request 
	var conditions = [];
	if(query.accountuid !== undefined) conditions.push("accountuid = '"+query.accountuid+"'");
	if(query.parentuid !== undefined) conditions.push("parentuid = '"+query.parentuid+"'");
	if(query.fileuid !== undefined) conditions.push("fileuid = '"+query.fileuid+"'");

	//Combine the conditions into a usable where query
	const where = conditions.length > 0 ? "WHERE "+conditions.join(" AND ") : "";


	var sql  = "SELECT fileuid, tags FROM file ";
	sql += where;
	sql += ";";


	(async () => {
		const client = await POOL.connect();
	
		try {
			console.log("Geting tags with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		} finally {
			client.release();
		}
	})();
});


router.get('/tags/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	var sql  = "SELECT fileuid, tags FROM file ";
	sql += "WHERE fileuid = '"+fileUID+"';";


	(async () => {
		const client = await POOL.connect();
	
		try {
			console.log("Geting tags with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		} finally {
			client.release();
		}
	})();
});









router.get('/', function(req, res, next) {
	//Get the parameters from the request
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	//Grab any conditions we care about from the parameters sent with the request 
	var conditions = [];
	if(query.accountuid !== undefined) conditions.push("accountuid = '"+query.accountuid+"'");
	if(query.parentuid !== undefined) conditions.push("parentuid = '"+query.parentuid+"'");
	if(query.fileuid !== undefined) conditions.push("fileuid = '"+query.fileuid+"'");

	//Combine the conditions into a usable where query
	const where = conditions.length > 0 ? "WHERE "+conditions.join(" AND ") : "";


	var sql  = "SELECT fileuid, userdefinedattr FROM file ";
	sql += where;
	sql += ";";


	(async () => {
		const client = await POOL.connect();
	
		try {
			console.log("Geting metadata with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
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

	var sql  = "SELECT fileuid, userdefinedattr FROM file ";
	sql += "WHERE fileuid = '"+fileUID+"';";


	(async () => {
		const client = await POOL.connect();
	
		try {
			console.log("Geting metadata with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		} finally {
			client.release();
		}
	})();
});



//-----------------------------------------------------------------------------
// Update Requests
//-----------------------------------------------------------------------------

//TODO Update json through postgres rather than overwriting

//Update file metadata by ID
router.post('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	const body = req.body;

	//Get the intersection of columns available to update and those sent in the request
	const bodyParams = Object.keys(body);
	const availableColumns = ["userdefinedattr", "tags"];
	
	var toUpdate = availableColumns.filter(column => bodyParams.includes(column));

	//If we don't have any of the required parameters...
	if(toUpdate.length <= 0) {
		return res.status(422).send({
			message: 'Metadata update request must contain any of [userdefinedattr, tags]'
		});
	}


	var updates = toUpdate.map(column => column+" = '"+body[column]+"'");

	var sql = "UPDATE file "
		+"SET "+updates.concat(", ")
		+" WHERE fileuid = '"+fileUID+"';";


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating metadata with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);
			
			//Send the retreived data
			console.log(rows);
			res.send("Metadata updated!");
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		} finally {
			client.release();
		}
	})();
});


module.exports = router;


/*
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
*/