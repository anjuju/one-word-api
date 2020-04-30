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
let numberCorrect = {
  correct: 0,
  skip: 0,
  wrong: 0,
}

let playersDB = [];

let numberOfPlayers;
let roundNumber = 0;

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

const setUpPg = async () => {
  await pgClient
  .query(
    `
    CREATE TABLE IF NOT EXISTS players (
      id TEXT NOT NULL,
      player_name TEXT NOT NUll,
      color TEXT NOT NULL,
      PRIMARY KEY (id)
    )
    `
  )
  .catch(err => console.log(err));

await pgClient
  .query(
    `
    CREATE TABLE IF NOT EXISTS clues (
      player_name TEXT NOT NUll,
      color TEXT,
      clue TEXT,
      PRIMARY KEY (player_name)
    )
    `
  )
  .catch(err => console.log(err));

await pgClient
  .query(
    `
    CREATE TABLE IF NOT EXISTS round_status (
      round INT,
      active_player text,
      active_word text,
      status text,
      outcome text,
      PRIMARY KEY (round)
    )
    `
  )
  .catch(err => console.log(err));

// await pgClient
//   .query(
//     `
//     DELETE FROM players;
//     DELETE FROM clues;
//     DELETE FROM round_status;
//     `
//   );

// await pgClient
//   .query(
//     `
//     INSERT INTO clues (
//       player_name,
//       color,
//       clue
//     )
//     VALUES
//       (
//         'angelica',
//         'red',
//         'testA'
//       ),
//       (
//         'bob',
//         'pink',
//         'testA'
//       ),
//       (
//         'cathy',
//         'blue',
//         'testinnnnggggC'
//       ),
//       (
//         'dylan',
//         'purple',
//         'testD'
//       ),
//       (
//         'elizabeth r',
//         'black',
//         'testD'
//       ),
//       (
//         'fran',
//         'yellow',
//         'testF'
//       );
//     `
//   ).catch(e => console.log(e));
};



// Sockets
const io = require('socket.io')(server);

io.on('connection', async socket => {  
  console.log('New client connected', socket.id);
  
  setUpPg();

  // Remove colors if people already chose colors
  const colorsChosen = await pgClient
    .query('SELECT color FROM players')
    .catch(e => console.log(e));
  
  if (colorsChosen.rows.length !== 0) {
    colorsChosen.rows.forEach(row => socket.emit('removeColors', { color: row.color } ));
  }

  // Set gameStarted as true if joining
  if (roundNumber > 0) {
    socket.emit('gameStarted');
  }

  // SET UP
  socket.on('submitSetUp', data => {
    const { name, color } = data;
    pgClient
      .query(
        `INSERT INTO players (id, player_name, color) 
        VALUES ($1, $2, $3)`, [socket.id, name, color]
      )
      .catch(e => console.log(`Creating player error: ${e}`));

    socket.broadcast.emit('removeColors', { color: data.color }); 
  });

  // Starting round
  socket.on('startRound', async () => {
  
    let activeWord = getWord();
    // choose activePlayer and rotate through
    // select player and make active true

    const players = await pgClient
      .query('SELECT player_name, color FROM players')
      .catch(e => console.log(`Couldn't get players: ${e}`));

    numberOfPlayers = players.rows.length;
    //console.log('numPlayers from start round', numberOfPlayers);
    
    playersDB = players.rows;

    let activePlayer = playersDB[roundNumber % numberOfPlayers];

    roundNumber++;

    pgClient
      .query(
        `INSERT INTO round_status (round, active_player, active_word, status)
        VALUES ($1, $2, $3, $4)`, [roundNumber, activePlayer.player_name, activeWord, "giving_clues"]
      )
      .catch(e => console.log(`Trouble updating active player: ${e}`));    
    
    pgClient
      .query('DELETE FROM clues')
      .catch(e => console.log(e));

    io.emit('startingRound', { activePlayer: activePlayer.player_name, activeColor: activePlayer.color, activeWord });
  });
  
  // Joining after game started
  socket.on('joinGame', async () => {
    const round = await pgClient
      .query(
        `SELECT * FROM round_status
        WHERE round=$1`, [roundNumber])
      .catch(e => console.log(e));
    
    const { active_player, active_word, status } = round.rows[0];

    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Couldn't get clues: ${e}`));

    switch (status) {
      case 'giving_clues':
        const color = await pgClient
          .query(
            `SELECT color FROM players
            WHERE player_name=$1`, [active_player])
          .catch(e => console.log(e));
        socket.emit('startingRound', { activePlayer: active_player, activeColor: color.rows[0].color, activeWord: active_word });
        break;
      case 'checking_clues':
        socket.emit('checkClues', { clues: clues.rows });
        break;
      case 'guessing':
        socket.emit('sendingClues', { clues: clues.rows });
        break;
      default:
        console.log('could not get proper round status', status );
    }
  })

  socket.on('getNewWord', async () => {
    const activeWord = getWord();

    await pgClient
      .query(
        `UPDATE round_status
        SET active_word=$1
        WHERE round=$2`, [activeWord, roundNumber]
      )
      .catch(e => console.log(`Trouble updating new word: ${e}`));

    io.emit('sendingWord', { activeWord });
  })

  socket.on('submitClue', async data => {
    const { name, color, clue } = data;
    await pgClient
      .query(
        `INSERT INTO clues (player_name, color, clue) 
        VALUES ($1, $2, $3)`, [name, color, clue]
      )
      .catch(e => console.log(`Clue input error: ${e}`));
    
      // console.log('number of clues', clues.rows.length);
      // console.log('number of players', numberOfPlayers);

    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Couldn't get clues: ${e}`));

    if (clues.rows.length === (numberOfPlayers - 1)) {
      console.log('automatically onto checking clues');
      await pgClient
        .query(
          `UPDATE round_status
          SET status=$1
          WHERE round=$2`, ["checking_clues", roundNumber]
        )
        .catch(e => console.log(`Trouble updating status: ${e}`));

      io.emit('checkClues', { clues: clues.rows });
    }
  });

  socket.on('ontoCheckingClues', async () => {
    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Couldn't get clues: ${e}`));
    
    await pgClient
      .query(
        `UPDATE round_status
        SET status=$1
        WHERE round=$2`, ["checking_clues", roundNumber]
      )
      .catch(e => console.log(`Trouble updating status: ${e}`));

    io.emit('checkClues', { clues: clues.rows });
  })

  socket.on('removeClue', async data => {
    const { clue } = data;
    await pgClient
      .query(
        `DELETE FROM clues
        WHERE clue=$1`, [clue]
      )
      .catch(e => console.log(`Clue remove error: ${e}`));

    const newClues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(e));

    // console.log(newClues.rows);
    io.emit('removingClues', { clues: newClues.rows });
  });

  socket.on('finishCheckingClues', async () => {
    const clues = await pgClient
      .query('SELECT * FROM clues')
      .catch(e => console.log(`Clue retrieval error: ${e}`));

    await pgClient
      .query(
        `UPDATE round_status
        SET status=$1
        WHERE round=$2`, ["guessing", roundNumber]
      )
      .catch(e => console.log(`Trouble updating status: ${e}`));

    io.emit('sendingClues', { clues: clues.rows })
  });

  socket.on('updateCorrect', async data => {
    const { outcome } = data;

    await pgClient
      .query(
        `UPDATE round_status
        SET outcome=$1
        WHERE round=$2`, [outcome, roundNumber]
      )
      .catch(e => console.log(`Trouble updating correct: ${e}`));
    
    const rounds = await pgClient
      .query(
        `SELECT * FROM round_status
        WHERE round=$1`, [roundNumber]);
    
    rounds.rows.forEach(row => {
      let newNumberCorrect = {...numberCorrect};
      newNumberCorrect[row.outcome]++;
      numberCorrect = newNumberCorrect;
    });
    //console.log('numberCorrect', numberCorrect);

    io.emit('numberCorrect', { numberCorrect });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    pgClient
      .query(
        `DELETE FROM players
        WHERE id=$1`, [socket.id]
      );
  });
});

// Routes

// app.post('/v1/player', async (req, res) => {
//   const { name, color } = req.body;
//   const id = uuidv4();
//   const player = await pgClient
//     .query(
//       `INSERT INTO players (id, player_name, color, active) VALUES ($1, $2, $3, $4)`, [id, name, color, false]
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