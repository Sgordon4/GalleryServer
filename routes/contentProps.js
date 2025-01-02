var express = require('express');
var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');


/*
Note: IBM Cloud Engine triggers have not been set up yet, so the cos can't call this api to 
tell us that an object has been uploaded. Therefore, we need to call things manually from 
the client each time we upload new content.
https://cloud.ibm.com/docs/codeengine
*/



//---------------------------------------------------------------------------------------------
// Properties
//---------------------------------------------------------------------------------------------

//Get content properties
router.get('/:name', async function(req, res, next) {
	var name = req.params.name;
	console.log(`\nGET CONTENT PROPS called with name='${name}'`);

	var sql =
	`SELECT name, size, createtime FROM content
	WHERE name = '${name}';`;


	(async () => {
		const client = await POOL.connect();

		console.log(`Fetching content properties with sql -`);
		console.log(sql.replaceAll("\t","").replaceAll("\n", " "));

		client.query(sql)
		.then(({rows}) => {
			if (rows.length != 0) 
				res.send(rows[0])
			else 
				res.sendStatus(404);
		})
		.catch((err) => {
			console.error(`Error getting content props with name='${name}': \n${err.code} - ${err.message}\n`);
			res.status(400).send(`${err.code} - ${err.message}`);
		})
		.finally(() => {
			console.log("Inside finally");
			client.release();
		});
	})();
});


//Upsert a content props entry
router.put('/', async function(req, res, next) {
	const reqProps = ["name", "size"];

	for(var i = 0; i < reqProps.length; i++) {
		var prop = reqProps[i];
		if(!req.body[prop]) {
			console.log(`Content props create request must contain '${prop}'!`);
			return res.status(422).send({ message: `Content props create request must contain '${prop}'!` });
		}
	}


	const name = req.body.name;
	const size = req.body.size;
	console.log(`\nPUT CONTENT PROPS called with size='${size}', hash='${name}'`);



	//Later this should be triggered by a function on the cloud's end
	const sql = 
	`INSERT INTO content (name, size)
	VALUES ('${name}', '${size}')
	ON CONFLICT (name) DO UPDATE
	SET size = excluded.size, createtime =
	extract(epoch from date_trunc('second', (now() at time zone 'utc')))
	returning name, size, createtime;`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating content props entry with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});


//Delete the content props
router.delete('/:hash', function(req, res, next) {
	const name = req.params.hash;
	console.log(`\nDELETE CONTENT PROPS called with hash='${name}'`);


	const sql = 
	`DELETE FROM content
	WHERE name = '${name}';`;
	
	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Deleting content props with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);
			res.send(ret.rows[0]);
		} 
		catch (err) {
			console.error(err);
			res.send(err);
		}
		finally { client.release(); }
	})();
});



module.exports = router;