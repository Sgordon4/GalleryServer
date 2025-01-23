var express = require('express');
const { ExpressValidator } = require('express-validator');
const { check, matchedData, validationResult } = require('express-validator');
const { body } = new ExpressValidator({}, {
	wrap: value => {
	  return "'"+value+"'";
	},
});

var router = express.Router();
var path = require('path');

const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



const fileFields = ["fileuid", "accountuid", "isdir", "islink", "isdeleted", "filesize", "filehash", 
	"userattr", "attrhash", "changetime", "modifytime", "accesstime", "createtime"];


//TODO Use 502 or 504 status if IBM comes back weird
//Also 507 if user storage space is used up


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


//GET /files/{fileId} returns content with etag
//GET /files/{fileId}/link returns uri of content with etag
//GET /files/{fileId}/userattr returns userattr with etag
//GET /files/{fileId}/metadata returns all properties

const fileTableColumns = ["fileuid", "accountuid", "isdir", "islink", "checksum", "filesize", 
	"userattr", "attrhash", "changetime", "modifytime", "accesstime", "createtime"]

const fileUIDCheck = () => body('fileuid').isUUID().withMessage("Must be a UUID!").wrap();
const accountUIDCheck = () => body('accountuid').isUUID().withMessage("Must be a UUID!").wrap();
const isDirCheck = () => body('isdir').isBoolean().withMessage("Must be a boolean!");
const isLinkCheck = () => body('islink').isBoolean().withMessage("Must be a boolean!");
const checksumCheck = () => body('checksum').isHash('sha256').withMessage("Must be an SHA256 hash!").wrap();
const fileSizeCheck = () => body('filesize').isInt().withMessage("Must be a number!");;
const userAttrCheck = () => body('userattr').isJSON().withMessage("Must be a JSON object!").wrap();
const attrHashCheck = () => body('attrhash').isHash('sha256').withMessage("Must be an SHA256 hash!").wrap();
const changetimeCheck = () => body('changetime').isInt().withMessage("Must be an epoch value!");
const modifytimeCheck = () => body('modifytime').isInt().withMessage("Must be an epoch value!");
const accesstimeCheck = () => body('accesstime').isInt().withMessage("Must be an epoch value!");
const createtimeCheck = () => body('createtime').isInt().withMessage("Must be an epoch value!");

const deviceUIDCheck = () => body('deviceuid').isUUID().withMessage("Must be a UUID!");
const ifMatchCheck = () => check("If-Match").isHash('sha256').withMessage("Must be an SHA256 hash!");



const createValidations = [fileUIDCheck(), accountUIDCheck(), deviceUIDCheck(),
	isDirCheck().optional(),  isLinkCheck().optional(), checksumCheck().optional(), 
	fileSizeCheck().optional(), userAttrCheck().optional(), attrHashCheck().optional(), 
	changetimeCheck().optional(), modifytimeCheck().optional(), accesstimeCheck().optional(), 
	createtimeCheck().optional()];

router.put('/create', createValidations, async function(req, res, next) {
	console.log(`\nCREATE FILE called`);
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot create file!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}

	const data = matchedData(req);

	//deviceUID is needed for use in Journal, but is not actually a field in the file database
	const deviceUID = data.deviceuid;
	delete data.deviceuid; 

	const keys = Object.keys(data);
	const vals = Object.values(data);


	var sql = `INSERT INTO file (${keys.join(", ")}) VALUES (${vals.join(", ")}) `;

	//Replace the file if it was deleted. We 'delete' a file by setting isdeleted=true and hiding it.
	keys.push("isdeleted");
	vals.push("false");

	sql += `ON CONFLICT (fileuid) DO UPDATE SET (${keys.join(", ")}) = (${vals.join(", ")}) `;
	sql += `WHERE file.isdeleted IS true `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Creating file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);

			//If we don't get anything back, that means the insert failed and the file already exists
			if(ret.rows.length == 0)
				return res.status(409).send("File already exists!");

			const fileProps = ret.rows[0];


			//Add an entry to the Journal with the new file information
			const changes = {
				checksum: fileProps.checksum,
				attrhash: fileProps.attrhash,
				changetime: fileProps.changetime,
				createtime: fileProps.createtime
			}
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime)


			return res.status(201).send(fileProps);
		} 
		catch (err) {
			console.log(`File creation failed!`);
			console.log(err);
			return res.status(500).send(err);
		}
		finally { client.release(); }
	})();
});





//https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests#avoiding_the_lost_update_problem_with_optimistic_locking

//TODO Is there a way to return different things from the db depending on how the where fails, e.g. hash fail vs does not exist? 

const contentValidations = [fileUIDCheck(), accountUIDCheck(), deviceUIDCheck(), ifMatchCheck(),
	checksumCheck(), fileSizeCheck(), changetimeCheck().optional(), modifytimeCheck().optional()]

router.put('/content', contentValidations, async function(req, res, next) {
	console.log(`\nUPDATE FILE CONTENT called`);
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot update content!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}

	const data = matchedData(req);

	//If-Match is used to avoid lost updates
	const ifMatch = data["if-match"];
	delete data["if-match"]; 
	console.log("If-Match: "+ifMatch);

	//deviceUID is needed for use in Journal, but is not actually a field in the file database
	const deviceUID = data.deviceuid;
	delete data.deviceuid; 


	//If changetime or modifytime weren't included, set them to the current epoch timestamp
	data.changetime = data.changetime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";
	data.modifytime = data.modifytime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";


	const keys = Object.keys(data);
	const vals = Object.values(data);

	var sql = `UPDATE file SET (${keys.join(", ")}) = (${vals.join(", ")}) `;
	sql += `WHERE file.fileuid = ${data.fileuid} AND file.checksum = '${ifMatch}'AND file.isdeleted IS false `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;

	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating file contents with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
			
			var ret = await client.query(sql);

			//If we don't get anything back, that means the update failed and the file does not exist
			if(ret.rows.length == 0)
				return res.status(404).send("File does not exist!");

			const fileProps = ret.rows[0];


			//Add an entry to the Journal with the new file information
			const changes = {
				checksum: fileProps.checksum,
				attrhash: fileProps.attrhash,
				changetime: fileProps.changetime,
				modifytime: fileProps.modifytime
			}
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime)


			return res.status(200).send(fileProps);
		} 
		catch (err) {
			console.log(`File content update failed!`);
			console.log(err);
			return res.status(500).send(err);
		}
		finally { client.release(); }
	})();
});
	

router.put('/attrs', async function(req, res, next) {
	console.log(`\nUPDATE FILE ATTRS called`);
	const body = req.body;
});

router.put('/timestamps', async function(req, res, next) {
	console.log(`\nUPDATE FILE TIMESTAMPS called`);
	const body = req.body;
});


router.put('/delete', async function(req, res, next) {
	console.log(`\nDELETE FILE called`);
	const body = req.body;
});










async function putJournal(client, fileUID, accountUID, deviceUID, changes, changetime) {
	var sql = `INSERT INTO journal (fileUID, accountUID, deviceUID, changes, changetime) `;
	sql += `VALUES ('${fileUID}', '${accountUID}', '${deviceUID}', '${changes}', ${changetime}) `;
	sql += `RETURNING *;`;

	console.log("Creating journal with sql -");
	console.log(sql.replaceAll("\t","").replaceAll("\n", " "));
	
	var ret = await client.query(sql);

	//If we don't get anything back, that means the insert failed
	if(ret.rows.length == 0)
		throw new Error("Journal insert failed!");
}





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