var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");


//TODO Better error handling


router.get('/:id', async function(req, res, next) {
	const accountUID = req.params.id;
	console.log(`\nGET ACCOUNT called with accountUID='${accountUID}'`);


	var sql =
	`SELECT accountuid, rootfileuid, email, displayname, 
	isdeleted, logintime, createtime FROM account
	WHERE accountuid = '${accountUID}'`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching account properties with sql -`);
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			const {rows} = await client.query(sql);


			if(rows.length == 0)
				res.sendStatus(404);
			else {
				res.send(rows[0]);
			}
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


router.put('/' , async function(req, res, next) {
	console.log(`\nINSERT ACCOUNT called`);
	const body = req.body;


	//Accounts can be created on a local device, and then copied to the server later.
	//We need to allow all columns to be sent to allow for that. 
	const allProps = ["accountuid", "rootfileuid", "email", "displayname", "password", 
		"isdeleted", "logintime", "changetime", "createtime"];
	const reqInsert = ["accountuid", "rootfileuid", "email", "displayname", "password"];

	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	for(const [key, val] of Object.entries(body)) {
		if(allProps.includes(key)) {
			props.push(key);
			vals.push(`'${val}'`);
		}
	}



	//Make sure we have what we need to create the account
	for(var i = 0; i < reqInsert.length; i++) {
		var column = reqInsert[i];
		if(props.indexOf(column) == -1) {
			console.log(`Account creation failed!`);
			var errJson = `{"status" : "fail", `
				+`"data" : {"${column}" : "Account create request must contain ${column}!"}}`
			console.log(errJson);
			return res.status(422).send(errJson);
		}
	};



	const sql = `INSERT INTO account (${props.join(", ")}) VALUES (${vals.join(", ")})
			ON CONFLICT (accountuid) DO NOTHING
			RETURNING *;`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Inserting account with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);	
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.log(`Account creation failed!`);

			//If this email already exists, inform the client
			if(err.code == '23505') {
				var errJson = `{"status" : "fail", `
				+`"data" : {"email" : "An account already exists with email='${body.email}'!"}}`

				console.log(errJson);
				res.status(409).send(errJson);
			}
			else {
				console.log(err);
				res.status(409).send(err);
			}
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


router.put('/:id' , async function(req, res, next) {
	console.log(`\nUPDATE ACCOUNT called`);
	const accountUID = req.params.id;
	const body = req.body;


	//Including accountuid in this list allows the accountuid to be changed, probably don't want
	const allProps = [/*"accountuid", */"rootfileuid", "email", "displayname", "password", 
		"isdeleted", "logintime", "changetime", "createtime"];

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
		console.log(`Account update failed!`);
		var errJson = `{"status" : "fail", "data" : null, "message" : `+
		`"Account update requires at least one of the following columns: [${allProps.join(", ")}]"}`
		console.log(errJson);
		return res.status(422).send(errJson);
	}
	for(var i = 0; i < reqInsert.length; i++) {
		var column = reqInsert[i];
		if(props.indexOf(column) == -1) {
			
		}
	};


	//Can't use parentheses with only one column
	const pr = (props.length == 1) ? `${props[0]}` : `(${props.join(", ")})`;
	const sql = `UPDATE account SET ${pr} = (${vals.join(", ")})
			WHERE accountuid = '${accountUID}'
			RETURNING *;`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating account with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);	
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.log(`Account update failed!`);
		
			console.log(err);
			res.status(409).send(err);
		}
		finally { client.release(); }
	})();
});


//-----------------------------------------------------------------------------


/* GET accounts listing. */
/*
router.get('/', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	(async () => {
		const client = await POOL.connect();

		try {
			const {rows} = await client.query('SELECT * FROM account;');
			console.log("Accounts queried!");

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});
*/


module.exports = router;
