var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");



//TODO Update account



router.get('/:id', async function(req, res, next) {
	const accountUID = req.params.id;
	console.log(`\nGET ACCOUNT called with accountUID='${accountUID}'`);


	var sql =
	`SELECT accountuid, email, displayname, 
	rootfileuid, createtime FROM account
	WHERE accountuid = '${accountUID}'
	AND deletetime is null;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log(`Fetching account properties with sql -`);
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


//TODO Email needs to be unique
//Create a new account
router.post('/', async function(req, res, next) {
	console.log(`\nCREATE ACCOUNT called`);

	const body = req.body;
	if(!body.email || !body.displayname || !body.password) {
		console.log(`Account create request must contain an email, displayname, and password!`);
		return res.status(422).send({ message: `Account create request must contain an email, displayname, and password!` });
	}


	//Grab the properties we care about
	const usefulProps = ["email", "displayname", "password"];

	var propHelper = [];
	var valueHelper = [];
	for(const [key, val] of Object.entries(body)) {
		if(val && usefulProps.includes(key)) {
			propHelper.push(key);
			valueHelper.push(`'${val}'`);
		}
	}

	
	const sql = 
	`WITH accountupdate AS
	(
		INSERT INTO account (${propHelper.join(", ")})
		VALUES (${valueHelper.join(", ")})
		RETURNING *
	),
	fileupdate AS 
	(
		INSERT INTO file (fileuid, owneruid, isdir)
		SELECT rootfileuid, accountuid, true
		FROM accountupdate
		RETURNING *
	), 
	journalupdate AS 
	(
		INSERT INTO journal 
		(fileuid, owneruid, filesize, fileblocks)
		SELECT fileuid, owneruid, filesize, fileblocks
		FROM fileupdate
	)
	SELECT accountuid, email, displayname, rootfileuid FROM accountupdate;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating new account with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			
			res.send(ret.rows[0]);
		} 
		catch (err) {
			
			
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
