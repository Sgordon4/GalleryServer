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

Post redirect 
https://stackoverflow.com/questions/38810114/node-js-with-express-how-to-redirect-a-post-request


IBM COS NodeJS API
https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-node
https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html

//Might have shit for upload
https://github.com/gustavares/cos-tutorial/blob/master/TUTORIAL.md#312-getpresignedurl-function


Planned API structure:

Return  list of files for the provided accounts/parents or 1 fileuid, including their basic attributes. 
Returns json in the form of accountuid { parentuid { file, file, ... }}. 
Each file object includes (fileuid, filename, isdirectory, issymboliclink, creationdate).

../files?account&parentUID&...						Need to include scaling (max 100, etc).
../files/fileUID

*/



//Get the file properties
router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileuid='${fileUID}'`);


	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		//Key: fileUID, 
		Key: "smiley.png", 
		Expires: 60 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.redirect(url);
	});


	generateStateUpdateSQL(fileUID, "lastfileaccessdate");
});





//-----------------------------------------------------------------------------
// File Data
//-----------------------------------------------------------------------------

//Get a presigned GET url to access the file itself
router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileuid='${fileUID}'`);


	console.log(`Generating signed get url...`);
	IBMCOS.getSignedUrlPromise('getObject', { 
		Bucket: IBMCOSBucket, 
		//Key: fileUID, 
		Key: "smiley.png", 
		Expires: 60 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.redirect(url);
	});


	generateStateUpdateSQL(fileUID, "lastfileaccessdate");
});


//-----------------------------------------------------------------------------

//Get a presigned PUT url to upload to the file itself
router.get('/upload/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nAttempting to generate put url for UID='${fileUID}'`);


	console.log(`Generating signed put url...`);
	IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: fileUID, 
		Expires: 600 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.send(url);
		next();
	});
});

//Update the state table for uploading a file
router.get('/upload/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	//File doesn't technically update here, but good enough until I get redirect working
	//Can't do checksum or whatever until then either (if ever :'( )

	//Since this can be called for any arbitrary ID, don't make a new entry. 
	//New entry should only be created on put requests.
	var updateStateSql = `update state set `
		+`fileuid = '${fileUID}', `
		+`lastfileupdatedate = (now() at time zone 'utc') `
		+`where fileuid = '${fileUID}';`;
	console.log(`Updating state lastfileupdatedate with sql:\n${updateStateSql}`);

	var client;
	try {
		client = await POOL.connect();
		/*await*/client.query(updateStateSql);
	} 
	catch (err) {
		console.error(err);
	} 
	finally {
		if(client != null) client.release();
		next();
	}
});


//Error handling for put request (not used rn)
router.get('/upload/:id', function (err, req, res, next) {
	if (err.type === 'put') {
		res.send('Something went wrong');
		console.log(err.error);
	}
});




//-----------------------------------------------------------------------------















//TODO Don't allow an update unless the user sends the lastSynced checksum and it matches the current server version
//Put the file itself
router.put('/:id', function(req, res, next) {
	const fileUID = req.params.id;

	var url = `https://gallery-cloud-object-storage.s3.us-east.cloud-object-storage.appdomain.cloud/f899139d-f5e1-3593-9643-1415e770c6dd?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=4b493ca412fc4541a7b7235f103ff1be%2F20240507%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240507T134735Z&X-Amz-Expires=6000&X-Amz-Signature=d77ce3313adeb308a067652c184fa845c005b85bf7cca68f4818e70a31a4e752&X-Amz-SignedHeaders=host`;
	//res.redirect(307, url);

	
	//Steps:
	//Check that fileUID exists
	//Generate presigned URL
	//Redirect request to presigned url for create/upload
	(async () => {
		try {
			//We don't care if the file exists in the database, there will be a cleanup job for orphan files

			//Note: putObject creates a file if it doesn't already exist
			console.log(`Generating signed put url...`);
			IBMCOS.getSignedUrlPromise('putObject', { 
				Bucket: IBMCOSBucket, 
				Key: fileUID, 
				Expires: 6000 //seconds
			})
			.then(url => {
				console.log(`Signed url generated: \n${url}`);
				res.status(307).redirect(url);
			});
		} 
		catch (e) {
			console.error(`Error uploading file: ${e.message}\n`);
			res.sendStatus(404);
		}
	})();
	
});


//-----------------------------------------------------------------------------

//Delete the file itself
router.delete('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nAttempting to delete file with UID='${fileUID}'`);

	(async () => {
		try {
			//Delete object from IBM COS (sets delete marker)
			console.log(`Deleting object from IBM COS...`);
			IBMCOS.deleteObject({
				Bucket: IBMCOSBucket,
				Key: fileUID
			}).promise()
			.then(() => {
				console.log(`Deleted fileUID='${fileUID}'`);
				res.sendStatus(200);
			});
		} 
		catch (e) {
			console.error(`Error deleting file: ${e.code} - ${e.message}\n`);
			res.send(e);
			//res.sendStatus(404);
		}
	})();
});


//-----------------------------------------------------------------------------
// File Properties
//-----------------------------------------------------------------------------

//Get the file properties for the provided ID
router.get('/properties/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nAttempting to fetch file properties with UID='${fileUID}'`);


	var sql ="SELECT fileuid, filename, parentuid, accountuid, isdirectory, issymboliclink, "
			+"userdefinedattr, tags, creationdate FROM file "
			+"WHERE fileuid = '"+fileUID+"' "
			+"AND deleted != true;";

	(async () => {

		try {
			const client = await POOL.connect();
			console.log(`Fetching file properties with sql:\n${sql}`);
			const {rows} = await client.query(sql);
			client.release();


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.send(rows[0]);

		} 
		catch (err) {
			client.release();
			console.error(err);
			res.send(err);
		}
	})();

});


//-----------------------------------------------------------------------------

//TODO Don't allow an update unless the user sends the lastSynced checksum and it matches the current server version
//Put the file properties for the provided ID
router.put('/properties/:id', function(req, res, next) {
	const fileUID = req.params.id;
	const body = req.body;
	console.log(`\nAttempting to write file with UID='${fileUID}'`);
	console.log(body);


	const allProps = ["fileuid", "filename", "filename", "parentuid", "accountuid", "isdirectory", "issymboliclink", 
	"userdefinedattr", "tags", "deleted"]
	const requiredProps = ["fileuid", "filename", "accountuid"]



	//Filter the recieved properties down to the ones we care about
	var receivedProps = Object.keys(body);
	receivedProps = receivedProps.filter(prop => allProps.includes(prop));

	//Grab all the values sent over for the properties we care about
	var receivedVals = [];
	for(const prop of receivedProps) 
		receivedVals.push(body[prop]);
	
	// console.log(`File has properties:`);
	// for(const prop of receivedProps) {
	// 	console.log(`${prop}=${body[prop]}`)
	// }



	//If receivedProps doesn't have all the required parameters...
	if(!requiredProps.every(prop => receivedProps.includes(prop))) {
		console.log("File put request must contain all of [filename, accountuid, accountuid]");
		return res.status(422).send({
			message: 'File put request must contain all of [filename, accountuid, accountuid]'
		});
	}
	//Check to make sure no weird shit is going on with fileUID
	if(fileUID != body.fileuid) {
		console.log("File put request fileUIDs must match")
		return res.status(422).send({
			message: 'File put request fileUIDs must match'
		});
	}


	var props = receivedProps.join(", ");

	var vals = receivedVals.map(prop => {
		if(prop == 'null')
			return prop;
		return `'${prop}'`;
	}).join(", ");

	

	//Note: If we don't trust the app to generate the FileUID, we'll need to use "returning fileuid" here.
	//This only returns ID when file is actually created, not on duplicate create requests.
	//See https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql

	const sql = `insert into file (${props}, creationdate) `
	+`values (${vals}, (now() at time zone 'utc')) `
	+`on conflict (fileuid) do update `
	+`set (${props}, creationdate) `
	+`= (${vals}, (now() at time zone 'utc'));`;



	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Putting file with sql -");
			console.log(sql);
			
			var ret = await client.query(sql);
			res.send(ret);
		} 
		catch (e) {
			console.error(`Error putting file in database: ${e.message}\n`);
			res.sendStatus(404);
		} finally {
			client.release();
		}
	})();
});


//-----------------------------------------------------------------------------

//Delete the file from the database (sets delete marker)
router.delete('/properties/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nAttempting to delete file properties with UID='${fileUID}'`);

	(async () => {
	  const client = await POOL.connect();
		try {
			//Get the file data's location
			const sql = `UPDATE file SET deleted = true WHERE fileuid='${fileUID}'`;
			console.log(`Setting file deleted with sql:\n${sql}`);
			await client.query(sql);


			//Always send a 200 unless delete actually failed, don't want to give out info
			res.sendStatus(200);
		} 
		catch (e) {
			console.error(`Error deleting file: ${e.code} - ${e.message}\n`);
			res.send(e);
			//res.sendStatus(404);
		} finally {
			client.release();
		}
	})();
});



module.exports = router;




/*
IBMCOS.getSignedUrlPromise('putObject', { 
		Bucket: IBMCOSBucket, 
		Key: fileUID, 
		Expires: 600 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.send(url);
	});
*/



/*
//TODO Maybe require a body param with accountid or something? Sending only files for that account?
router.get('/', function(req, res, next) {
	console.log(`\nAttempting to fetch all files`);

	const query = req.query;
	console.log(`Available queries:`);
	console.log(query);

	//Grab any conditions we care about from the parameters sent with the request 
	var conditions = [];
	if(query.accountuid !== undefined) conditions.push("accountuid = '"+query.accountuid+"'");
	if(query.parentuid !== undefined) conditions.push("parentuid = '"+query.parentuid+"'");
	if(query.fileuid !== undefined) conditions.push("fileuid = '"+query.fileuid+"'");
	console.log(`Accepted conditions:`);
	console.log(conditions);


	//Combine the conditions into a usable where query
	const where = conditions.length > 0 ? " WHERE "+conditions.join(" AND ") : "";


	var getFileSql  = "SELECT fileuid, filename, isdirectory, issymboliclink, "
			+"accountuid, parentuid, creationdate, deleted FROM file";
	getFileSql += where;
	getFileSql += " LIMIT 500;";
	

	(async () => {
	  const client = await POOL.connect();

		try {
			console.log(`Selecting files with sql:\n${getFileSql}`);
			const {rows} = await client.query(getFileSql);

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
*/