// Express App Setup 
const express = require('express'); 
const http = require('http'); 
const bodyParser = require('body-parser'); 
const cors = require('cors'); 
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Initialization 
const app = express(); 
app.use(cors()); 
app.use(bodyParser.json()); 

// Server 
const port = 8080; 
const server = http.createServer(app); 

// Helpers
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

const words = fs.readFileSync('words.txt').toString().split('\n');

const getWord = function() {
  let word = words[Math.floor(Math.random()*words.length)];
  return word;
};

// Database storage in API
const numberCorrect = {
  correct: 0,
  skip: 0,
  wrong: 0,
}

const activePlayers = [];

let numberOfPlayers;
let roundNumber;

// Postgres
const config = require('./postgres/config');

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
      id TEXT NOT NULL,
      playerName TEXT NOT NUll,
      color TEXT NOT NULL,
      active BOOLEAN DEFAULT false,
      PRIMARY KEY (id)
    )
    `
  )
  .catch(err => console.log(err));

pgClient
  .query(
    `
    CREATE TABLE IF NOT EXISTS clues (
      playerName TEXT NOT NUll,
      color TEXT,
      clue TEXT,
      PRIMARY KEY (playerName)
    )
    `
  )
  .catch(err => console.log(err));

pgClient
  .query(
    `
    CREATE TABLE IF NOT EXISTS roundstatus (
      round INT,
      status text
    )
    `
  )
  .catch(err => console.log(err));


// Sockets
const io = require('socket.io')(server);

io.on('connection', socket => {  
  console.log('New client connected', socket.id);
  
  socket.on('chooseColor', data => {
    socket.broadcast.emit('removeColors', { color: data.color });
  });

  socket.on('submitSetUp', async data => {
    const { name, color } = data;
    await pgClient
      .query(
        `INSERT INTO players (id, playerName, color, active) 
        VALUES ($1, $2, $3, $4)`, [socket.id, name, color, false]
      )
      .catch(e => console.log(`Creating player error: ${e}`));
  });

  socket.on('startRound', async () => {
    //console.log('starting round with active player');
    let activeWord = getWord();
    // choose activePlayer and rotate through
    // select player and make active true
    io.emit('startingRound', { activePlayer: 'guesser', activeColor: 'pink', activeWord });
    
    const players = await pgClient
      .query('SELECT playerName FROM players')
      .catch(e => console.log(`Couldn't get playerName: ${e}`));

    numberOfPlayers = players.rows.length;
    console.log('numPlayers from start round', numberOfPlayers);
    roundNumber++;
  });

  socket.on('submitClue', async data => {
    const { name, color, clue } = data;
    await pgClient
      .query(
        `INSERT INTO clues (playerName, color, clue) 
        VALUES ($1, $2, $3)`, [name, color, clue]
      )
      .catch(e => console.log(`Clue input error: ${e}`));

    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Couldn't get clues: ${e}`));
    
      console.log('number of clues', clues.rows.length);
      console.log('number of players', numberOfPlayers);

    if (clues.rows.length === (numberOfPlayers - 1)) {
      io.emit('checkClues', { clues: clues.rows });
    }
  });

  socket.on('removeClue', async data => {
    const { clue } = data;
    await pgClient
      .query(
        `DELETE FROM clues
        WHERE clue=$1`, [clue]
      )
      .catch(e => console.log(`Clue remove error: ${e}`));

    // io.emit('removingClue');
  });

  socket.on('finishCheckingClues', async () => {
    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Clue retrieval error: ${e}`));

    io.emit('sendingClues', { clues: clues.rows })
  });

  socket.on('updateCorrect', async data => {
    const { status } = data;

    await pgClient
      .query(
        `INSERT INTO roundstatus (round, status)
        VALUES (${roundNumber}, ${status})`
      )
      .catch(e => console.log(`Trouble updating correct: ${e}`));
    
    const rounds = await pgClient
      .query('SELECT * FROM roundstatus');
    
    rounds.rows.forEach(row => {
      const newNumberCorrect = {...numberCorrect};
      newNumberCorrect[row.status]++;
      numberCorrect = newNumberCorrect;
    });

    io.emit('numberCorrect', { numberCorrect });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    
  });
});

// Routes

// app.post('/v1/player', async (req, res) => {
//   const { name, color } = req.body;
//   const id = uuidv4();
//   const player = await pgClient
//     .query(
//       `INSERT INTO players (id, playerName, color, active) VALUES ($1, $2, $3, $4)`, [id, name, color, false]
//     )
//     .catch(e => {
//       res
//         .status(500)
//         .send('Encountered an internal error when creating player');
//     });
//     // console.log('created player');
//   return res.status(201).send(`Created ${color} player, ${name}`);
// });


server.listen(port, () => console.log(`Server running on port ${port}`));