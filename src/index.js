// Express App Setup 
const express = require('express'); 
const http = require('http'); 
const bodyParser = require('body-parser'); 
const cors = require('cors'); 
const uuid = require('uuid/v4'); 
const fs = require('fs');

// Initialization 
const app = express(); 
app.use(cors()); 
app.use(bodyParser.json()); 

// Server 
const port = 8080; 
const server = http.createServer(app); 

const io = require('socket.io')(server);


const colors = {
  red: '#b01320',
  hotPink: '#c325db',
  pink: '#d674af',
  orange: '#db8f37',
  yellow: '#c9c30c',
  green: '#20bd0f',
  teal: '#0a7d5e',
  blue: '#1679db',
  purple: '#6213d1',
  black: '#000000'
};

const database = {

}

// Postgres
const config = require('./config');

const { Pool } = require('pg');
const pgClient = new Pool({
  user: config.pgUser,
  host: config.pgHost,
  database: config.pgDatabase,
  password: config.pgPassword,
  port: config.pgPort
});
pgClient.on('error', () => console.log('Lost Postgres connection'));

pgClient
  .query(
    `
  CREATE TABLE IF NOT EXISTS players (
    id uuid,
    name TEXT NOT NUll,
    color TEXT NOT NULL,
    active BOOLEAN DEFAULT false,
    PRIMARY KEY (id)
  )
`
  )
  .catch(err => console.log(err));


// Routes

app.post('/v1/word', function (req, res) {
  const { name, color } = req.body;
  return res.status(200).json({

  })
});


server.listen(port, () => console.log(`Server running on port ${port}`));