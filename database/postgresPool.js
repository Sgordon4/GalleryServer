const path = require('path');
const {Pool} = require('pg');

require('dotenv').config({
  override: true,
  path: path.join(__dirname, 'pgconfig.env')
});

//Grab pool properties from pgconfig.env
const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.PORT
});

exports.POOL = pool