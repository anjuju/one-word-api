// Express App Setup 
const express = require('express'); 
const http = require('http'); 
const bodyParser = require('body-parser'); 
const cors = require('cors'); 
const uuid = require('uuid/v4'); 

// Initialization 
const app = express(); 
app.use(cors()); 
app.use(bodyParser.json()); 

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
};



// Server 
const port = 8080; 
const server = http.createServer(app); 
server.listen(port, () => console.log(`Server running on port ${port}`));