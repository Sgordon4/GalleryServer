
async function generateStateUpdateSQL(fileUID, column) {
	//Since this can be called for any arbitrary ID, don't make a new entry. 
	//New entry should only be created on put requests.
	var updateStateSql = `update state set `
		+`fileuid = '${fileUID}', `
		+`${column} = (now() at time zone 'utc') `
		+`where fileuid = '${fileUID}';`;
	console.log(`Updating state lastfileaccessdate with sql:\n${updateStateSql}`);


	var client;
	try {
		client = await POOL.connect();
		await client.query(updateStateSql);
	} 
	catch (err) {
		console.error(err);
	}
	finally {
		if(client != null) client.release();
	}
}