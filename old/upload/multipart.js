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
router.get('/:id', async function(req, res, next) {
	console.log("\nGETTING MULTIPART URLS");

	const fileUID = req.params.id;
	const numberOfParts = req.query.numberOfParts || 0;
	
	if( numberOfParts < 2) {
		return res.status(422).send({
			message: 'Multipart initlaizitaion request must contain numberOfParts >= 2!'
		});
	}


	try {
		console.log(`Attempting to generate UploadID for UID='${fileUID}'`);
		const response = await IBMCOS.createMultipartUpload({
			Bucket: IBMCOSBucket, 
			Key: fileUID
		}).promise();
		const UploadId = response.UploadId;
		console.log(`Response returned with UploadId='${UploadId}'`);


		console.log(`Attempting to generate ${numberOfParts} put urls for UploadId`);
		const promises = [];
		
		for(let i = 0; i < numberOfParts; i++) {
			const promise = IBMCOS.getSignedUrlPromise('uploadPart', {
				Bucket: IBMCOSBucket,
				Key: fileUID,
				UploadId: UploadId,
				PartNumber: i + 1
			});

			promises.push(promise);
		}
		const urls = await Promise.all(promises);
		console.log(`URLs generated!`);	//Maybe we do some null checks here

		
		const parts = urls.map((url, index) => ({
			part: index + 1,
			url: url
		}));

		res.status(200).json({ UploadId, parts });
	} catch (e) {
		console.log(e);
        next(e);
    }
});


//-----------------------------------------------------------------------------


//Complete the multipart upload
router.put('/:id', async function(req, res, next) { 
	console.log("\nCOMPLETING MULTIPART");

	const fileUID = req.params.id;
	const uploadId = req.body.uploadId;
	const partsETags = JSON.parse(req.body.partsETags);
	

	try {
		await IBMCOS.completeMultipartUpload({
			Bucket: IBMCOSBucket,
			Key: fileUID,
			UploadId: uploadId,
			MultipartUpload: { Parts: partsETags }
		}).promise();

        return res.status(200).json(`Multipart upload for ${fileUID} completed successfully.`);
    } catch (e) {
		console.log(e);
        next(e);
    }
});


//-----------------------------------------------------------------------------


//Abort the multipart upload
router.delete('/:id', async function(req, res, next) { 
	console.log("\nDELETING MULTIPART");

	const fileUID = req.params.id;
	const { uploadId } = req.query;

	try {
		await IBMCOS.abortMultipartUpload({
			Bucket: IBMCOSBucket,
			Key: fileUID,
			UploadId: uploadId
		}).promise();

		return res.status(200).json(`Multipart upload for ${fileUID} aborted successfully.`);
	} catch (e) {
		console.log(e);
        next(e);
    }
});


//-----------------------------------------------------------------------------


//TODO This does not work lmao. How do you format ListMultipartUploads? 
//Could not find it in 10 min. Whatever. Washed. Donezo. Hosed. Gone.

router.get('/incomplete', async function(req, res, next) {
	console.log(`\nGETTING INCOMPLETE MULTIPARTS`);


	console.log(`Generating signed get url...`);
	IBMCOS.ListMultipartUploads('getObject', { 
		Bucket: IBMCOSBucket, 
		// Key: fileUID, 
		Expires: 60 //seconds
	})
	.then(url => {
		console.log(`Signed url generated: \n${url}`);
		res.redirect(url);
	});


	generateStateUpdateSQL(fileUID, "lastfileaccessdate");
});



module.exports = router;