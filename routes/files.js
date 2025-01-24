var express = require('express');
const { ExpressValidator } = require('express-validator');
const { header, matchedData, validationResult } = require('express-validator');
const { body, param } = new ExpressValidator({}, {
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

const fileUIDParamCheck = () => param('fileuid').isUUID().withMessage("Must be a UUID!").wrap();

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
const ifMatchCheck = () => header("If-Match").isHash('sha256').withMessage("Must be an SHA256 hash!");


//----------------------------------------------------------------------------------------------------------------------------------------------------


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
			};
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime);


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



//----------------------------------------------------------------------------------------------------------------------------------------------------

//https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests#avoiding_the_lost_update_problem_with_optimistic_locking

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

	//These items are needed for where clauses and adding to Journal, but do not need to be updated in the file table
	const fileUID = data.fileuid;
	delete data.fileuid;

	const accountUID = data.accountuid;
	delete data.accountuid;

	const deviceUID = data.deviceuid;
	delete data.deviceuid;

	//If changetime or modifytime weren't included, set them to the current epoch timestamp
	data.changetime = data.changetime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";
	data.modifytime = data.modifytime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";


	var fileExistsSql = `SELECT fileuid FROM file WHERE fileuid = ${fileUID} and isdeleted = false;`

	const joined = Object.entries(data).map(item => item.join(" = ")).join(", ");
	var sql = `UPDATE file SET ${joined} `;
	sql += `WHERE file.fileuid = ${fileUID} AND file.checksum = '${ifMatch}' AND file.isdeleted IS false `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating file contents with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));

			//If we don't get anything back, that means the file does not exist
			var exists = await client.query(fileExistsSql);
			if(exists.rows.length == 0)
				return res.status(404).send("File does not exist!");


			//If we don't get anything back, that means the checksum doesn't match.
			//Technically the file could have also *just* been deleted by another process.
			var ret = await client.query(sql);
			if(ret.rows.length == 0)
				return res.status(412).send("File checksums don't match!");


			//Add an entry to the Journal with the new file information
			const fileProps = ret.rows[0];
			const changes = {
				checksum: fileProps.checksum,
				changetime: fileProps.changetime,
				modifytime: fileProps.modifytime
			};
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime);


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
	

//----------------------------------------------------------------------------------------------------------------------------------------------------


const attributeValidations = [fileUIDCheck(), accountUIDCheck(), deviceUIDCheck(), ifMatchCheck(), userAttrCheck(), changetimeCheck().optional()]

router.put('/attrs', attributeValidations, async function(req, res, next) {
	console.log(`\nUPDATE FILE ATTRS called`);
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot update attributes!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}

	const data = matchedData(req);

	//If-Match is used to avoid lost updates
	const ifMatch = data["if-match"];
	delete data["if-match"]; 

	//These items are needed for where clauses and adding to Journal, but do not need to be updated in the file table
	const fileUID = data.fileuid;
	delete data.fileuid;

	const accountUID = data.accountuid;
	delete data.accountuid;

	const deviceUID = data.deviceuid;
	delete data.deviceuid;

	//If changetime wasn't included, set it to the current epoch timestamp
	data.changetime = data.changetime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";


	var fileExistsSql = `SELECT fileuid FROM file WHERE fileuid = ${fileUID} and isdeleted = false;`

	const joined = Object.entries(data).map(item => item.join(" = ")).join(", ");
	var sql = `UPDATE file SET ${joined} `;
	sql += `WHERE file.fileuid = ${fileUID} AND file.attrhash = '${ifMatch}' AND file.isdeleted IS false `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating file attributes with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));

			//If we don't get anything back, that means the file does not exist
			var exists = await client.query(fileExistsSql);
			if(exists.rows.length == 0)
				return res.status(404).send("File does not exist!");


			//If we don't get anything back, that means the checksum doesn't match.
			//Technically the file could have also *just* been deleted by another process.
			var ret = await client.query(sql);
			if(ret.rows.length == 0)
				return res.status(412).send("File attrhash doesn't match!");


			//Add an entry to the Journal with the new file information
			const fileProps = ret.rows[0];
			const changes = {
				attrhash: fileProps.attrhash,
				changetime: fileProps.changetime,
			};
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime);


			return res.status(200).send(fileProps);
		} 
		catch (err) {
			console.log(`File attribute update failed!`);
			console.log(err);
			return res.status(500).send(err);
		}
		finally { client.release(); }
	})();
});


//----------------------------------------------------------------------------------------------------------------------------------------------------


const timestampValidations = [fileUIDCheck(), accountUIDCheck(), deviceUIDCheck(),
	changetimeCheck().optional(), modifytimeCheck().optional(), accesstimeCheck().optional()]

router.put('/timestamps', timestampValidations, async function(req, res, next) {
	console.log(`\nUPDATE FILE TIMESTAMPS called`);
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot update timestamps!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}

	const data = matchedData(req);

	//These items are needed for where clauses and adding to Journal, but do not need to be updated in the file table
	const fileUID = data.fileuid;
	delete data.fileuid;

	const accountUID = data.accountuid;
	delete data.accountuid;

	const deviceUID = data.deviceuid;
	delete data.deviceuid;
	
	//If no timestamp was included, we have nothing to update
	if(Object.keys(data).length == 0) 
		return res.status(422).send("File timestamp update must contain at least one of [changetime, modifytime, accesstime]!");

	//If changetime wasn't included, set it to the current epoch timestamp
	data.changetime = data.changetime || "extract(epoch from date_trunc('second', (now() at time zone 'utc')))";
		



	const joined = Object.entries(data).map(item => item.join(" = ")).join(", ");
	var sql = `UPDATE file SET ${joined} `;
	sql += `WHERE file.fileuid = ${fileUID} AND file.isdeleted IS false `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Updating file timestamps with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));

			//If we don't get anything back, that means the file does not exist
			var ret = await client.query(sql);
			if(ret.rows.length == 0)
				return res.status(404).send("File does not exist!");


			//Add an entry to the Journal with the new file information
			const fileProps = ret.rows[0];
			const changes = {};
			for(const key of Object.keys(data)) {
				changes[key] = fileProps[key];
			};
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime);


			return res.status(200).send(fileProps);
		} 
		catch (err) {
			console.log(`File timestamp update failed!`);
			console.log(err);
			return res.status(500).send(err);
		}
		finally { client.release(); }
	})();
});


//----------------------------------------------------------------------------------------------------------------------------------------------------


const deleteValidations = [fileUIDCheck(), accountUIDCheck(), deviceUIDCheck()]

router.delete('/', deleteValidations, async function(req, res, next) {
	console.log(`\nDELETE FILE called`);
	if(!validationResult(req).isEmpty()) {
		console.log("Body data has issues, cannot update timestamps!");
		return res.status(422).send({ errors: validationResult(req).array() });
	}

	const data = matchedData(req);


	//These items are needed for where clauses and adding to Journal, but do not need to be updated in the file table
	const fileUID = data.fileuid;
	delete data.fileuid;

	const accountUID = data.accountuid;
	delete data.accountuid;

	const deviceUID = data.deviceuid;
	delete data.deviceuid;
	

	var sql = `UPDATE file SET isdeleted = true `;
	sql += `WHERE file.fileuid = ${fileUID} AND file.isdeleted IS false `;
	sql += `RETURNING ${fileTableColumns.join(", ")};`;


	(async () => {
		const client = await POOL.connect();
		try {
			console.log("Deleting file with sql -");
			console.log(sql.replaceAll("\t","").replaceAll("\n", " "));

			//If we don't get anything back, that means the file does not exist or is already deleted
			var ret = await client.query(sql);
			if(ret.rows.length == 0)
				return res.status(404).send("File does not exist!");


			//Add an entry to the Journal with the new file information
			const fileProps = ret.rows[0];
			const changes = { isdeleted: true };
			putJournal(client, fileProps.fileuid, fileProps.accountuid, deviceUID, JSON.stringify(changes), fileProps.changetime);


			return res.status(200).send(fileProps);
		} 
		catch (err) {
			console.log(`File delete failed!`);
			console.log(err);
			return res.status(500).send(err);
		}
		finally { client.release(); }
	})();
});



//----------------------------------------------------------------------------------------------------------------------------------------------------



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



module.exports = router;