const path = require('path');
const {Pool} = require('pg');


require('dotenv').config({
  override: true,
  path: path.join(__dirname, 'pgconfig.env')
});


/*
WARNING!
The file pgconfig.env is included in the .gitignore so as to not expose critical state secrets, 
 and must be recreated per-system. The file should be created in this format:

PGHOST=postgres server IP
PGUSER=postgres account
PGPASSWORD=postgres account password
PGDATABASE=postgres database
PGPORT=5432
*/

//Grab pool properties from pgconfig.env 
const pool = new Pool({
	user: process.env.PGUSER,
	host: process.env.PGHOST,
	password: process.env.PGPASSWORD,
	database: process.env.PGDATABASE,
	port: process.env.PGPORT
});


exports.POOL = pool