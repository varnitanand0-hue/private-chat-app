const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active users per room
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join room
    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);
        socket.username = username;
        socket.roomId = roomId;
        
        // Track users in room
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        // Notify others in room
        socket.to(roomId).emit('user-joined', { username });
        
        // Send online status
        const roomSize = rooms.get(roomId).size;
        io.to(roomId).emit('room-status', { 
            online: roomSize > 1,
            count: roomSize 
        });
        
        console.log(`${username} joined room ${roomId}`);
    });
    
    // Send message
    socket.on('send-message', (data) => {
        socket.to(data.roomId).emit('receive-message', {
            id: data.id,
            username: data.username,
            text: data.text,
            timestamp: data.timestamp
        });
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user-typing', {
            username: data.username,
            isTyping: data.isTyping
        });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.roomId && rooms.has(socket.roomId)) {
            rooms.get(socket.roomId).delete(socket.id);
            
            const roomSize = rooms.get(socket.roomId).size;
            
            // Clean up empty rooms
            if (roomSize === 0) {
                rooms.delete(socket.roomId);
            } else {
                // Notify remaining users
                io.to(socket.roomId).emit('room-status', { 
                    online: roomSize > 1,
                    count: roomSize 
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
