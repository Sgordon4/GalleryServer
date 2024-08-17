var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



//TODO Remove insert and update, they have been replaced with upsert



//Get the file properties
router.get('/:id', async function(req, res, next) {
	const fileUID = req.params.id;
	console.log(`\nGET FILE called with fileUID='${fileUID}'`);


	var sql =
	`SELECT fileuid, accountuid, isdir, islink, fileblocks, filesize, filehash,
	isdeleted, changetime, modifytime, accesstime, createtime FROM file
	WHERE fileuid = '${fileUID}';`;

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


//Upsert file
router.put('/upsert/', async function(req, res, next) {
	console.log(`\nUPSERT FILE called`);
	const body = req.body;


	//Files can be created on a local device, and then copied to the server later.
	//We need to allow all columns to be sent to allow for that. 
	const allProps = ["fileuid", "accountuid", "isdir", "islink", "fileblocks", "filesize", "filehash",
		"isdeleted", "changetime", "modifytime", "accesstime", "createtime"]
	const reqInsert = ["fileuid", "accountuid"];

	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	for(const [key, val] of Object.entries(body)) {
		if(allProps.includes(key)) {
			props.push(key);
			vals.push(`'${val}'`);
		}
	}


	//Make sure we have what we need to create a file
	for(var i = 0; i < reqInsert.length; i++) {
		var column = reqInsert[i];
		if(props.indexOf(column) == -1) {
			console.log(`File creation failed!`);
			var errJson = `{"status" : "fail", `
				+`"data" : {"${column}" : "File upsert request must contain ${column}!"}}`
			console.log(errJson);
			return res.status(422).send(errJson);
		}
	};



	var sql = `INSERT INTO file (${props.join(", ")}) VALUES (${vals.join(", ")}) `;

	//If changetime is not manually specified, we want to set it for the UPDATE part of the query
	if(props.indexOf("changetime") == -1) {
		props.push("changetime");
		vals.push("(now() at time zone 'utc')");
	}

	sql += `ON CONFLICT (fileuid) DO UPDATE SET (${props.join(", ")}) = (${vals.join(", ")}) RETURNING *;`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Upserting file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
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

//Create a new file
router.put('/insert/', async function(req, res, next) {
	console.log(`\nINSERT FILE called`);
	const body = req.body;


	//Files can be created on a local device, and then copied to the server later.
	//We need to allow all columns to be sent to allow for that. 
	const allProps = ["fileuid", "accountuid", "isdir", "islink", "fileblocks", "filesize", "filehash",
		"isdeleted", "changetime", "modifytime", "accesstime", "createtime"]
	const reqInsert = ["fileuid", "accountuid"];

	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	for(const [key, val] of Object.entries(body)) {
		if(allProps.includes(key)) {
			props.push(key);
			vals.push(`'${val}'`);
		}
	}



	//Make sure we have what we need to create the file
	for(var i = 0; i < reqInsert.length; i++) {
		var column = reqInsert[i];
		if(props.indexOf(column) == -1) {
			console.log(`File creation failed!`);
			var errJson = `{"status" : "fail", `
				+`"data" : {"${column}" : "File create request must contain ${column}!"}}`
			console.log(errJson);
			return res.status(422).send(errJson);
		}
	};



	const sql = `INSERT INTO file (${props.join(", ")}) VALUES (${vals.join(", ")})
			ON CONFLICT (fileuid) DO NOTHING
			RETURNING *;`;
	

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Inserting file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.log(`File creation failed!`);

			console.log(err);
			res.status(409).send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


router.put('/update/:id' , async function(req, res, next) {
	console.log(`\nUPDATE FILE called`);
	const fileUID = req.params.id;
	const body = req.body;


	//Including fileuid in this list allows the fileuid to be changed, probably don't want
	const allProps = [/*"fileuid", */"accountuid", "isdir", "islink", "fileblocks", "filesize",
		"filehash", "isdeleted", "changetime", "modifytime", "accesstime", "createtime"]

	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	for(const [key, val] of Object.entries(body)) {
		if(allProps.includes(key)) {
			props.push(key);
			vals.push(`'${val}'`);
		}
	}


	//Make sure we have at least 1 column for the update
	if(props.length < 1) {
		console.log(`File update failed!`);
		var errJson = `{"status" : "fail", "data" : null, "message" : `+
		`"File update requires at least one of the following columns: [${allProps.join(', ')}]"}`
		console.log(errJson);
		return res.status(422).send(errJson);
	}


	//Can't use parentheses with only one column
	const pr = (props.length == 1) ? `${props[0]}` : `(${props.join(", ")})`;
	const sql = `UPDATE file SET ${pr} = (${vals.join(", ")})
			WHERE fileuid = '${fileUID}'
			RETURNING *;`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);	
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.log(`File update failed!`);
		
			console.log(err);
			res.status(409).send(err);
		}
		finally { client.release(); }
	})();
});


module.exports = router;