const path = require('path');
const {Pool} = require('pg');


require('dotenv').config({
  override: true,
  path: path.join(__dirname, 'pgconfig.env')
});


//Grab pool properties from pgconfig.env 
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT
});


exports.POOL = pool