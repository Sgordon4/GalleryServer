var express = require('express');
var router = express.Router();
var path = require('path');


const {POOL} = require('#root/database/postgresPool.js');
const {IBMCOS, IBMCOSBucket} = require('#root/storage/IBMCOS');



/*
TODO

IBM COS NodeJS API
https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-node
https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html

Fantastic resource for multipart uploading
https://github.com/gustavares/cos-tutorial/blob/master/TUTORIAL.md#312-getpresignedurl-function

ETags are the hex md5sum of each part.
We should also be sending the md5 hash of each part with the Content-MD5 header so that s3
 refuses corrupted chunks.
*/


//=============================================================================
//
// NOTE
// Multipart uploads aren't really used as the system uses a chunking system with block sizes = 5MB
//
//=============================================================================



//=============================================================================
// Multipart Upload
//=============================================================================


//Initiate multipart upload, get upload urls for each part
router.get('/:fileName/:numparts', async function(req, res, next) {
	console.log("\nGETTING MULTIPART URLS");

	const fileName = req.params.fileName;
	const numberOfParts = req.params.numparts || 0;
	
	if( numberOfParts < 2) {
		return res.status(422).send({
			message: 'Multipart initlaizitaion request must contain numberOfParts >= 2!'
		});
	}


	try {
		console.log(`Attempting to generate UploadID for fileName='${fileName}'`);
		const response = await IBMCOS.createMultipartUpload({
			Bucket: IBMCOSBucket, 
			Key: fileName
		}).promise();
		const uploadID = response.UploadId;
		console.log(`Response returned with UploadId='${uploadID}'`);


		console.log(`Attempting to generate ${numberOfParts} put urls for UploadId`);
		const promises = [];
		
		for(let i = 0; i < numberOfParts; i++) {
			const promise = IBMCOS.getSignedUrlPromise('uploadPart', {
				Bucket: IBMCOSBucket,
				Key: fileName,
				UploadId: uploadID,
				PartNumber: i + 1
			});

			promises.push(promise);
		}
		const partURLs = await Promise.all(promises);
		console.log("UploadID: '"+uploadID+"'");
		console.log(`URLs generated!`);	//Maybe we do some null checks here


		res.status(200).json({ uploadID, partURLs });
	} catch (e) {
		console.log(e);
        next(e);
    }
});


//-----------------------------------------------------------------------------


//Complete the multipart upload
router.put('/:fileName/:uploadID', async function(req, res, next) { 
	console.log("\nCOMPLETING MULTIPART");

	const fileName = req.params.fileName;
	const uploadID = req.params.uploadID;
	const etags = JSON.parse(req.body.ETags);

	console.log(etags);
	


	
	try {
		await IBMCOS.completeMultipartUpload({
			Bucket: IBMCOSBucket,
			Key: fileName,
			UploadId: uploadID,
			MultipartUpload: { Parts: etags }
		}).promise();

        return res.status(200).json(`Multipart upload for ${fileName} completed successfully.`);
    } catch (e) {
		if(e.code == "NoSuchUpload") {
			res.sendStatus(404);
		}
		else if(e.code == "EntityTooSmall") {
			res.status(400).send("Your proposed upload is smaller than the minimum allowed size. "+
				"All parts but the last must be >= 5MB.");
		}
		console.log(e);
        next(e);
    }
});


//-----------------------------------------------------------------------------


//Abort the multipart upload
router.delete('/:fileName/:uploadID', async function(req, res, next) { 
	console.log("\nDELETING MULTIPART");

	const fileName = req.params.fileName;
	const uploadId = req.params.uploadID;

	try {
		await IBMCOS.abortMultipartUpload({
			Bucket: IBMCOSBucket,
			Key: fileName,
			UploadId: uploadId
		}).promise();

		return res.status(200).json(`Multipart upload for ${fileName} aborted successfully.`);
	} catch (e) {
		if(e.code == "NoSuchUpload")
			res.sendStatus(404);
		else {
			console.log(e);
			next(e);
		}
    }
});


//-----------------------------------------------------------------------------


//Gets all open but incomplete multipart upload requests
router.get('/incomplete', async function(req, res, next) {
	console.log(`\nGETTING INCOMPLETE MULTIPARTS`);

	const activeUploads = await IBMCOS.listMultipartUploads({ 
		Bucket: IBMCOSBucket
	}).promise();

	res.send(activeUploads.Uploads);
});



module.exports = router;