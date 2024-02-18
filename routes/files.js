var express = require('express');
var router = express.Router();

const {POOL} = require("../database/postgresPool");


/*
Planned API structure:

Return list of files for a given account/parent file. Need to include scaling (max 100, etc)
../files?account&parentUID&...

Return contents of file
../files/fileUID


Return list of metadata of files for a given account/parent file. Need to include scaling (max 100, etc)
../files/metadata?account&parentUID&...

Return metadata of file
../files/metadata/fileUID
*/



router.get('/', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	(async () => {
	  const client = await POOL.connect();

		try {
			const {rows} = await client.query('SELECT * FROM file;');
			console.log("Files queried!");

			res.send(rows);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});



router.get('/:id', function(req, res, next) {
	const query = req.query;
	console.log("Queries: ");
	console.log(query);

	const fileUID = req.params.id;

	(async () => {
	  const client = await POOL.connect();

		try {
			const {rows} = await client.query("SELECT EXISTS"
				+"(SELECT 1 FROM file WHERE fileuid = '"+fileUID+"');");
			console.log("Files queried!");

			res.send('File info for id: ' + req.params.id
				+"<br>File exists: "+rows[0].exists);
		} 
		catch (err) {
			console.error(err);
		} finally {
			client.release();
		}
	})();
});


module.exports = router;
