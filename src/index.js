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

const io = require('socket.io')(server);

io.on('connection', socket => {
  console.log('New client connected', socket.id);
  
  socket.on('chooseColor', data => {
    console.log('chose color', data.color);
    socket.broadcast.emit('removeColors', { color: data.color });
  });

  socket.on('startGame', () => {
    console.log('starting game with active player');
    let activeWord = getWord();
    io.emit('startingGame', { activePlayer: 'testPlayer', activeColor: 'red', activeWord });
  })
/*
  // Create new game room
  socket.on('createGame', data => {    
    ++gameState.numOfRooms;
    let roomId = 'room-' + gameState.numOfRooms;
    socket.join(roomId);
    gameState[roomId] = {
      board: generateBoard(),
      players: {
        [socket.id]: data.role,
      }
    };
    //console.log('gameState', gameState);
    socket.emit('creatingGame', {
      roomId,
      board: gameState[roomId].board,
    });    
  });

  //Connect new player to requested room
  socket.on('joinGame', data => {
    const { role, roomId } = data;
    if (_.isUndefined(gameState[roomId]) || _.isUndefined(gameState[roomId].board)) {
      socket.emit('joiningGame', {
        error: 'No game in progress with that Room ID!'
      });
    } else {
      socket.join(roomId);
      gameState[roomId].players[socket.id] = role;
      socket.emit('joiningGame', {
        roomId: roomId,
        board: gameState[roomId].board
      });
    }
  })

  //Handle tile clicked
  socket.on('clickTile', data => {
    const { roomId } = data;
    gameState[roomId].board = data.board;
    // emits to all except sender
    socket.to(roomId).emit('updateBoard', {
      board: gameState[roomId].board
    });
  });

  socket.on('getNewBoard', data => {
    const { roomId } = data;
    gameState[roomId].board = generateBoard();
    // emits to everyone including sender
    io.in(roomId).emit('updateBoard', {
      board: gameState[roomId].board,
      role: {}
    });
  });

  socket.on('leaveRoom', data => {
    const { roomId } = data;
    //console.log('player', socket.id, 'left', roomId);
    socket.leave(roomId);
    delete gameState[roomId].players[socket.id];
    
    // if (Object.keys(gameState[roomId].players).length === 0) {
    //   delete gameState[roomId]
    // }
  });
*/
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    
  });
});


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
      id uuid,
      playerName TEXT NOT NUll,
      color TEXT NOT NULL,
      active BOOLEAN DEFAULT false,
      PRIMARY KEY (id)
    )
    `
  )
  .catch(err => console.log(err));


// Routes

app.post('/v1/player', async (req, res) => {
  const { name, color } = req.body;
  const id = uuidv4();
  const player = await pgClient
    .query(
      `INSERT INTO players (id, playerName, color, active) VALUES ($1, $2, $3, $4)`, [id, name, color, false]
    )
    .catch(e => {
      res
        .status(500)
        .send('Encountered an internal error when creating player');
    });
    // console.log('created player');
  return res.status(201).send(`Created ${color} player, ${name}`);
});


server.listen(port, () => console.log(`Server running on port ${port}`));