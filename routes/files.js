var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");


/*
TODO
Add compression
Remove sql injection vulnerabilities


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


const IBM = require('ibm-cos-sdk');

var config = {
    endpoint: 'https://s3.us-east.cloud-object-storage.appdomain.cloud/gallery-cloud-object-storage/',
    apiKeyId: '<api-key>',
    serviceInstanceId: '<resource-instance-id>',
    signatureVersion: 'iam',
};

var cos = new IBM.S3(config);


router.get('/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	(async () => {
	  const client = await POOL.connect();
		try {
			//Get the file data's location
			const sql = "select uri from file "
				+"where fileuid = '"+fileUID+"';";
			console.log("Geting file uri with sql -");
			console.log(sql);
			const {uri} = await client.query(sql);



			var isIBMCloud = uri.startsWith("https://s3.us-east.cloud-object-storage.appdomain.cloud/gallery-cloud-object-storage/");

			if(isIBMCloud) {
				//https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-node
			}


			//TODO Get the actual file data
			const fileData = uri;


			//Send the retreived data
			console.log(fileData);
			res.send(fileData);
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
// Create Requests
//-----------------------------------------------------------------------------

//Create a new file
//Returns the new file's UID
router.put('/:id', function(req, res, next) {
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
