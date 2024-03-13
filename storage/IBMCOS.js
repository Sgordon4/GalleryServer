const path = require('path');
const IBM = require('ibm-cos-sdk');

require('dotenv').config({
	override: true,
	path: path.join(__dirname, 'ibmconfig.env')
});


/*
WARNING!
The file ibmconfig.env is included in the .gitignore so as to not expose critical state secrets, 
 and must be recreated per-system. The file should be created in this format:

IBMENDPOINT=IBM public COS endpoint, not including the bucket
IBMSERVICEINSTANCEID=GUID of the storage object, not the bucket
IBMBUCKET=name of the bucket
IBMAPIKEYID=apikey of the service credentials for the desired bucket
IBMHMACACCESSKEYID=hmac access key for the service credentials
IBMHMACSECRETACCESSKEY=hmac secret key for the service credentials
IBMSIGNATUREVERSION=v4, required version for hmac credential url signing 
*/


var config = {
    endpoint: process.env.IBMENDPOINT,
    serviceInstanceId: process.env.IBMSERVICEINSTANCEID,
    apiKeyId: process.env.IBMAPIKEYID,
	accessKeyId: process.env.IBMHMACACCESSKEYID,
	secretAccessKey:process.env.IBMHMACSECRETACCESSKEY,
    signatureVersion: process.env.IBMSIGNATUREVERSION,
};

const IBMCOSBucket = process.env.IBMBUCKET;


var cos = new IBM.S3(config);

exports.IBMCOS = cos;
exports.IBMCOSBucket = IBMCOSBucket;


/*
https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-node#node-examples-list-objects


//Example function
//Can return IBMCOS.listObjects(...) and succeeding then() calls as a promise

function getBucketContents() {
    console.log(`Retrieving bucket contents from: ${IBMCOSBucket}`);
    return IBMCOS.listObjects( {Bucket: IBMCOSBucket} ).promise()
		.then((data) => {
			if (data != null && data.Contents != null && data.Name != null) {
				console.log(`Reading from '${data.Name}'`);
				data.Contents.map(item => {
					console.log(`+ ${item.Key} (${item.Size} bytes).`);
				});
			}
		}).catch((e) => {
			console.error(`ERROR - Retrieving file: ${e.code} - ${e.message}\n`);
		});
}

*/