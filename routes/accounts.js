var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");


/* GET accounts listing. */
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

module.exports = router;
