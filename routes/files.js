var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



const fileFields = ["fileuid", "accountuid", "isdir", "islink", "isdeleted", "filesize", "filehash", 
	"userattr", "attrhash", "changetime", "modifytime", "accesstime", "createtime"];




//Get the file properties
router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileUID='${fileUID}'`);


	var sql =
	`SELECT fileuid, accountuid, isdir, islink, filesize, filehash,
	userattr, attrhash, changetime, modifytime, accesstime, createtime FROM file
	WHERE isdeleted=false AND fileuid = '${fileUID}';`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching file properties with sql -`);
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.send(rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------



router.put('/create', async function(req, res, next) {
	console.log(`\nCREATE FILE called`);
	const body = req.body;


	//Files can be created on a local device, and then copied to the server later.
	//We need to allow all columns to be sent to allow for that. 
	const allProps = ["fileuid", "accountuid", "isdir", "islink", "filesize", "filehash", 
		"userattr", "attrhash", "changetime", "modifytime", "accesstime", "createtime"]
	const reqInsert = ["fileuid", "accountuid"];

	//Make sure we have what we need to create a file
	for(const column of reqInsert) {
		if(body[column] == undefined) {
			console.log(`File creation missing required components!`);
			var errJson = `{"status" : "fail", "data" : {"${column}" : "File upsert request must contain ${column}!"}}`
			console.log(errJson);
			return res.status(422).send(errJson);
		}
	}


	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	
	//We want every property included, even if they were not passed.
	for(const key of allProps) {
		var val = body[key];

		//If a property was not passed, set it to its default. 
		if(val == undefined)
			val = "DEFAULT";		//Should we just "continue;"?

		props.push(key);

		//Postgres array notation is ass
		if(key == "userattr" && val == "{")
			vals.push(`'${val}'`);
		else
			vals.push(`${val}`);
	}


	var sql = `INSERT INTO file (${props.join(", ")}) VALUES (${vals.join(", ")}) `;




});


router.put('/update/content', async function(req, res, next) {
	console.log(`\nUPDATE FILE CONTENT called`);
	const body = req.body;
});

router.put('/update/attrs', async function(req, res, next) {
	console.log(`\nUPDATE FILE ATTRS called`);
	const body = req.body;
});

router.put('/update/timestamps', async function(req, res, next) {
	console.log(`\nUPDATE FILE TIMESTAMPS called`);
	const body = req.body;
});


router.put('/delete', async function(req, res, next) {
	console.log(`\nDELETE FILE called`);
	const body = req.body;
});
















//-----------------------------------------------------------------------------


//Upsert file
router.put('/', async function(req, res, next) {
	console.log(`\nUPSERT FILE called`);
	const body = req.body;
	

	//Files can be created on a local device, and then copied to the server later.
	//We need to allow all columns to be sent to allow for that. 
	const allProps = ["fileuid", "accountuid", "isdir", "islink", "filesize", "filehash", 
		"userattr", "attrhash", "changetime", "modifytime", "accesstime", "createtime"]
	const reqInsert = ["fileuid", "accountuid"];


	//Make sure we have what we need to create a file
	for(const column of reqInsert) {
		if(body[column] == undefined) {
		//if(passedEntries.indexOf(column) == -1) {
			console.log(`File creation failed!`);
			var errJson = `{"status" : "fail", "data" : {"${column}" : "File upsert request must contain ${column}!"}}`
			console.log(errJson);
			return res.status(422).send(errJson);
		}
	}



	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	
	//We want every property included, even if they were not passed.
	for(const key of allProps) {
		var val = body[key];

		//If a property was not passed, set it to its default. 
		//WARNING: This could backfire if this isn't considered when sending properties. Will be fine for our purposes.
		if(val == undefined)
			val = "DEFAULT";

		props.push(key);

		//Postgres array notation is ass
		if(key == "userattr" && val == "{")
			vals.push(`'${val}'`);
		else
			vals.push(`${val}`);
	}
	


	var sql = `INSERT INTO file (${props.join(", ")}) VALUES (${vals.join(", ")}) `;


	
	//Edit values for the UPDATE part of the sql ----------------------------
	
	//Remove fileuid from properties as it should not be updated (fileuid is guaranteed to be the first element)
	props.shift();
	vals.shift();

	//If changetime is not manually specified, we want to set it for the UPDATE part of the query
	if(props.indexOf("changetime") == -1) {
		props.push("changetime");
		vals.push("extract(epoch from date_trunc('second', (now() at time zone 'utc')))");
	}

	//Ensure the file is not hidden. If we move a file from s->l, the server file is 'deleted' by hiding it.
	//However, if we go back from l->s, the file will still be hidden without this change below.
	//Doing this via trigger on update has proven unsuccessful (possible, but touchy)
	props.push("isdeleted");
	vals.push("false");



	sql += `ON CONFLICT (fileuid) DO UPDATE SET (${props.join(", ")}) = (${vals.join(", ")}) `;



	//Compare filehash if one was included
	var fileHashWhere;
	if(req.query.prevfilehash == undefined)
		fileHashWhere = `(file.filehash IS NULL OR file.isdeleted IS true) `
	else if(req.query.prevfilehash != null) 
		fileHashWhere = `file.filehash = '${req.query.prevfilehash}' `

	//Compare attrhash if one was included
	var attrHashWhere;
	if(req.query.prevattrhash == undefined)
		attrHashWhere = `(file.attrhash IS NULL OR file.isdeleted IS true) `
	else if(req.query.prevattrhash != null) 
		attrHashWhere = `file.attrhash = '${req.query.prevattrhash}' `

	//Join them together into one WHERE statement as long as they aren't null
	if(fileHashWhere != null || attrHashWhere != null)
		sql += "WHERE " + [fileHashWhere, attrHashWhere].filter(Boolean).join("AND ");


	//NOTE: attrhash must be returned by this 'RETURNING ...' section or the journal trigger 
	// will not work, as it won't find a changed attrhash in the returned props

	sql += `RETURNING ${allProps.join(", ")};`;

	//Replace all double quotes with single, postgres doesn't like that.
	//Note: We don't have any columns that use quotes internally atm, but this would cause problems for ones that do.
	//sql = sql.replace(/"/g, "'");
	sql = sql.replace(/""/g, "''");


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Upserting file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);

			//If we don't get anything back, that means the insert failed (99% chance prevHashes don't match)
			if(ret.rows.length == 0)
				res.status(412).send("Hashes do not match");

			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.log(`File upsert failed!`);

			console.log(err);
			res.status(409).send(err);
		}
		finally { client.release(); }
	})();

});


//-----------------------------------------------------------------------------


//'Delete' the file by setting isdeleted=true
router.delete('/:id', function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nDELETE FILE called with fileuid='${fileUID}'`);


	const sql = 
	`UPDATE file SET isdeleted = true
	WHERE fileuid = '${fileUID}'
	RETURNING *`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Deleting file entry with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			if(rows.length == 0)
				res.sendStatus(404);
			else
				res.sendStatus(200);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});



module.exports = router;