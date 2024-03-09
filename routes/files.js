var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");
const {IBMCOS, IBMCOSBucket} = require("../storage/IBMCOS");



/*
TODO
Add compression
Remove sql injection vulnerabilities

Nice example for async vs then, helps me refresh
https://stackoverflow.com/a/70206098


Planned API structure:

Return  list of files for the provided accounts/parents or 1 fileuid, including their basic attributes. 
Returns json in the form of accountuid { parentuid { file, file, ... }}. 
Each file object includes (fileuid, filename, isdirectory, issymboliclink, creationdate).

../files?account&parentUID&...						Need to include scaling (max 100, etc).
../files/fileUID

*/


//-----------------------------------------------------------------------------
// Get Requests
//-----------------------------------------------------------------------------

//TODO Maybe require a body param with accountid or something? Sending only files for that account?
router.get('/', function(req, res, next) {
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


	var sql  = "SELECT fileuid, filename, isdirectory, issymboliclink, accountuid, parentuid, creationdate, deleted FROM file ";
	sql += where;
	sql += ";";
	

	(async () => {
	  const client = await POOL.connect();

		try {
			console.log("Selecting files with sql -");
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



router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`Reading file with UID=${fileUID}`);

	//Get the file contents from the IBM bucket, using the UID as the name
	try {
		const data = await IBMCOS.getObject({ Bucket: IBMCOSBucket, Key: fileUID }).promise();
		if (data == null) 
			throw new Error(`File data returned null for FileUID = ${fileUID}`);

		//Send the file
		res.send(data.Body);
	} catch (e) {
		console.error(`Error reading file: ${e.code} - ${e.message}\n`);
		res.sendStatus(404);
	}
});



//-----------------------------------------------------------------------------
// Create Requests
//-----------------------------------------------------------------------------

//Create a new file
//Returns the new file's UID
router.put('/', function(req, res, next) {
	const body = req.body;

	//Check that we have everything we need to create a new file
	const requiredProps = ["accountuid", "filename", "parentuid", "isdirectory", "issymboliclink"]
	const hasAllKeys = requiredProps.every(prop => Object.prototype.hasOwnProperty.call(body, prop));

	//If we don't have all the required parameters...
	if(!hasAllKeys) {
		return res.status(422).send({
			message: 'New file request must contain all of [accountuid, filename, parentuid, and file type]'
		});
	}


	(async () => {
		const client = await POOL.connect();
	
		//TODO: Only returns ID when file is actually created, not on duplicate create requests.
		//See https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql
		try {
			//Insert a new file with a random UID, using the parameters from 'body'. Return the UID.
			const sql = "insert into file(fileuid, accountuid, filename, parentuid, isdirectory, issymboliclink, creationDate) "
				+"values (gen_random_uuid (), '"+body.accountuid+"', '"+body.filename+"', "
				+body.parentuid+", '"+body.isdirectory+"', '"+body.issymboliclink+"', (now() at time zone 'utc')) "
				+"on conflict (accountuid, filename, parentuid) do nothing "
				+"returning fileuid;";
			console.log("Creating file with sql -");
			console.log(sql);
			
			var newFileUID = await client.query(sql);	
			console.log("EEEEEEEEE"+newFileUID);		
			res.send(newFileUID);
		} 
		catch (e) {
			console.error(`Error creating file in database: ${e.message}\n`);
			res.sendStatus(404);
		} finally {
			client.release();
		}


		/*
		//Create a new file in the IBM Cloud
		try {
			cos.putObject({
				Bucket: IBMCOSBucket,
				Key: newFileUID
				//,Body: null
			}).promise()
			.then(() => {
				console.log(`Item: ${itemName} created!`);
			})
			.catch((e) => {
				console.error(`ERROR: ${e.code} - ${e.message}\n`);
			});
		} catch (e) {
			console.error(`Error creating file in cos: ${e.code} - ${e.message}\n`);
			res.sendStatus(404);
		}
		*/


	})();
});


router.put('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`Writing file with UID=${fileUID}`);

	//Check that we have everything we need to write to the file
	const requiredProps = ["data"]
	const hasAllKeys = requiredProps.every(prop => Object.prototype.hasOwnProperty.call(body, prop));

	//If we don't have all the required parameters...
	if(!hasAllKeys) {
		return res.status(422).send({
			message: 'Write file request must contain a data parameter!'
		});
	}
});




router.delete('/delete/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	(async () => {
	  const client = await POOL.connect();
		try {
			//Get the file data's location
			const sql = "delete from file "
				+"where fileuid = '"+fileUID+"';";
			console.log("Deleting file uri with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);			

			//Send the retreived data
			console.log(rows);
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


router.put('/delete/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	//Get the file data's location
	const sql = "update file "
	+"set deleted = true "
	+"where fileuid = '"+fileUID+"';";

	(async () => {
	  const client = await POOL.connect();
		try {
			console.log("Setting file deleted with sql -");
			console.log(sql);
			const {rows} = await client.query(sql);			

			//Send the retreived data
			console.log(rows);
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


module.exports = router;
