const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['https://bibung.netlify.app'],
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

app.use(cors({
    origin: ['https://bibung.netlify.app'],
    methods: ['GET', 'POST'],
    credentials: true,
}));

let queue = [];
let userRoomMap = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinQueue', ({ username }) => {
        if (username) {
            console.log('User joined queue:', username);
            queue.push({ socket, username });
        } else {
            console.log("No username provided:", socket.id);
        }

        // Check if we can pair users
        if (queue.length >= 2) {
            const [user1, user2] = queue.splice(0, 2);
            const roomId = `room-${user1.socket.id}-${user2.socket.id}`;
            console.log('Pairing users:', user1.username, 'and', user2.username, 'in room:', roomId);
 
            userRoomMap[user1.socket.id] = roomId;
            userRoomMap[user2.socket.id] = roomId;
            
            user1.socket.join(roomId);
            user2.socket.join(roomId);

            user1.socket.emit('connectToRoom', roomId);
            user2.socket.emit('connectToRoom', roomId);
        }
    });

    socket.on('joinRoom', (roomId) => {
        console.log(`Socket ${socket.id} joining room: ${roomId}`);
        socket.join(roomId);
    });

    socket.on('message', ({ message }, roomId) => {
        console.log(`Message received from ${socket.id}:`, message, "to room:", roomId);
        // Emit the message to all clients in the room except the sender
        socket.to(roomId).emit('message', { message, senderId: socket.id });
    });

    socket.on('typing', (roomId) => {
        socket.to(roomId).emit('typing', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find the room the user was part of
        const roomId = userRoomMap[socket.id];
        if (roomId) {
            console.log(`Notifying users in room ${roomId} about disconnection of socket ${socket.id}`);
            // Notify the remaining user in the room
            socket.to(roomId).emit('roomClosed', socket.id);
            // Remove the user from the room map
            delete userRoomMap[socket.id];
        }
    
        // Remove the user from the queue
        queue = queue.filter((user) => user.socket.id !== socket.id);
    });
});

server.listen(3001, () => {
    console.log('bhola Im Listening on http://192.168.1.41:3001');
});
