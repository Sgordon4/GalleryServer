var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");




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
	reqInsert.forEach(column => {
		if(props.indexOf(column) == -1) {
			console.log(`Account create request must contain ${column}!`);
			return res.status(422).end();		//Is there a code we should send
		}
	});



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
			

			console.log(err);
			res.send(err);

			/*
			//If this email already exists, inform the client
			if(err.code == '23505') {
				console.log(`Account creation failed!`);
				console.log(`An account already exists with email='${body.email}!'`);
				res.status(409).send({message: `An account already exists with email='${body.email}'!`});
			}
			else {
				console.log(err);
				res.send(err);
			}
			*/
		}
		finally { client.release(); }
	})();
});




//Upsert an account
router.put('/' , async function(req, res, next) {
	console.log(`\nUPSERT ACCOUNT called`);
	const body = req.body;

	
	const allProps = ["accountuid", "rootfileuid", "email", "displayname", "password", 
		"isdeleted", "logintime", "changetime", "createtime"];
	const reqInsert = ["accountuid", "rootfileuid", "email", "displayname", "password"];
	const reqUpdate = ["accountuid"];

	//Grab any valid properties passed in the response body
	var props = [];
	var vals = [];
	for(const [key, val] of Object.entries(body)) {
		if(allProps.includes(key)) {
			props.push(key);
			vals.push(`'${val}'`);
		}
	}



	const sql = `INSERT INTO account (${props.join(", ")}) VALUES (${vals.join(", ")})
			ON CONFLICT (accountuid) DO NOTHING
			RETURNING *;`;

	

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Upserting account with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			
			res.send(ret.rows[0]);
		} 
		catch (err) {
			

			console.log(err);
			res.send(err);

			/*
			//If this email already exists, inform the client
			if(err.code == '23505') {
				console.log(`Account creation failed!`);
				console.log(`An account already exists with email='${body.email}!'`);
				res.status(409).send({message: `An account already exists with email='${body.email}'!`});
			}
			else {
				console.log(err);
				res.send(err);
			}
			*/
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
