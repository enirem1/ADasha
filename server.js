const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MySQL Database Configuration
const db = mysql.createConnection({
    host: 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'parking'
});

db.connect(err => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO Users (username, password, role) VALUES (?, ?, "user")', 
        [username, hashedPassword], 
        (err, results) => {
            if (err) return res.status(500).send(err.message);
            res.status(201).send('User registered successfully');
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        db.query('SELECT * FROM Users WHERE username = ?', [username], async (err, results) => {
            if (err) return res.status(500).json({ message: err.message });
            if (results.length === 0) return res.status(401).json({ message: 'User not found' });
            
            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
            
            const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Get Parking Spots
app.get('/api/parking', async (req, res) => {
    db.query('SELECT * FROM ParkingSpots', (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.json(results);
    });
});

// Update Parking Spot and Log Action
app.post('/api/parking/update', async (req, res) => {
    const { id, status, user_id } = req.body;
    db.query('UPDATE ParkingSpots SET status = ?, user_id = ? WHERE id = ?', 
    [status, user_id || null, id], (err, results) => {
        if (err) return res.status(500).send(err.message);
        
        // Log the parking action
        const action = status === 'occupied' ? 'entry' : 'exit';
        db.query('INSERT INTO Logs (user_id, spot_id, action, timestamp) VALUES (?, ?, ?, NOW())', 
        [user_id || null, id, action], (logErr) => {
            if (logErr) return res.status(500).send(logErr.message);
            res.send('Parking spot updated and logged');
        });
    });
});

// Get Logs
app.get('/api/logs', async (req, res) => {
    const query = `
        SELECT logs.id, logs.user_id, users.username, logs.spot_id, logs.timestamp, logs.action 
        FROM Logs logs
        LEFT JOIN Users users ON logs.user_id = users.id
        ORDER BY logs.timestamp DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.json(results);
    });
});
// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const WebSocket = require('ws');

// Add this to your server.js after the Express setup
// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected devices
const connectedDevices = new Set();
// Add/modify in your server.js file to properly handle ESP32 communications

// Modify this WebSocket message handler to match ESP32 expectations
wss.on('connection', (ws) => {
    console.log('Device connected to WebSocket');
    connectedDevices.add(ws);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received data from device:', data);
            
            // Handle IR sensor updates from ESP32
            if (data.type === 'spot_update') {
                const { spotId, isOccupied } = data;
                const status = isOccupied ? 'occupied' : 'vacant';
                
                // Update database with the new spot status
                db.query('UPDATE ParkingSpots SET status = ? WHERE id = ?', 
                [status, spotId], (err, results) => {
                    if (err) {
                        console.error('Database update error:', err);
                        return;
                    }
                    
                    // Broadcast the update to all connected clients (web and ESP32)
                    broadcastSpotUpdate(spotId, status);
                    
                    // Log the action in the database
                    const action = isOccupied ? 'entry' : 'exit';
                    db.query('INSERT INTO Logs (spot_id, action, timestamp) VALUES (?, ?, NOW())', 
                    [spotId, action], (logErr) => {
                        if (logErr) console.error('Log entry error:', logErr);
                    });
                });
            }
            // Handle ESP32 requesting available spots count
            else if (data.type === 'request_count') {
                db.query('SELECT COUNT(*) as available FROM ParkingSpots WHERE status = "vacant"', 
                (err, results) => {
                    if (err) {
                        console.error('Error fetching available count:', err);
                        return;
                    }
                    
                    const availableCount = results[0].available;
                    
                    // Send count only to the requesting device
                    ws.send(JSON.stringify({
                        type: 'available_count',
                        count: availableCount
                    }));
                });
            }
        } catch (e) {
            console.error('Error parsing message from device:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('Device disconnected');
        connectedDevices.delete(ws);
    });
    
    // Send initial parking data to the device
    db.query('SELECT * FROM ParkingSpots', (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }
        
        ws.send(JSON.stringify({
            type: 'initial_data',
            spots: results
        }));
    });
});

// Function to broadcast spot updates to all connected devices
function broadcastSpotUpdate(spotId, status) {
    const message = JSON.stringify({
        type: 'spot_status_change',
        spotId: spotId,
        status: status
    });
    
    connectedDevices.forEach(device => {
        try {
            device.send(message);
        } catch (e) {
            console.error('Error sending to device:', e);
        }
    });
}

// Make sure the API endpoints for barrier control are properly implemented
// Add a system user ID for non-user actions (use an existing admin user's ID)
const SYSTEM_USER_ID = 1;  // Use your admin user ID here
// Add this variable to track the auto-close timer
let barrierAutoCloseTimer = null;

// Update the open barrier endpoint
app.post('/api/barrier/open', (req, res) => {
    // Send command to ESP32 to open barrier
    connectedDevices.forEach(device => {
        try {
            device.send(JSON.stringify({
                type: 'barrier_control',
                action: 'open'
            }));
        } catch (e) {
            console.error('Error sending to device:', e);
        }
    });
    
    // Log the barrier action with NULL spot_id
    db.query('INSERT INTO Logs (user_id, spot_id, action, timestamp) VALUES (NULL, NULL, "barrier_open", NOW())', 
    (err) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Clear any existing timer to prevent multiple timers
        if (barrierAutoCloseTimer) {
            clearTimeout(barrierAutoCloseTimer);
        }
        
        // Set auto-close timer for 30 seconds
        barrierAutoCloseTimer = setTimeout(() => {
            console.log('Auto-closing barrier after 30 seconds');
            
            // Auto-close the barrier
            connectedDevices.forEach(device => {
                try {
                    device.send(JSON.stringify({
                        type: 'barrier_control',
                        action: 'close'
                    }));
                } catch (e) {
                    console.error('Error sending to device:', e);
                }
            });
            
            // Log the auto-close action
            db.query('INSERT INTO Logs (user_id, spot_id, action, timestamp) VALUES (NULL, NULL, "barrier_close_auto", NOW())', 
            (logErr) => {
                if (logErr) console.error('Error logging auto-close:', logErr);
            });
            
            barrierAutoCloseTimer = null;
        }, 30000); // 30 seconds
        
        res.json({ message: 'Barrier opened successfully (will auto-close in 30 seconds)' });
    });
});

// Update the close barrier endpoint to clear the timer when manually closed
app.post('/api/barrier/close', (req, res) => {
    // Clear any existing auto-close timer
    if (barrierAutoCloseTimer) {
        clearTimeout(barrierAutoCloseTimer);
        barrierAutoCloseTimer = null;
    }
    
    // Send command to ESP32 to close barrier
    connectedDevices.forEach(device => {
        try {
            device.send(JSON.stringify({
                type: 'barrier_control',
                action: 'close'
            }));
        } catch (e) {
            console.error('Error sending to device:', e);
        }
    });
    
    // Log the barrier action with NULL spot_id
    db.query('INSERT INTO Logs (user_id, spot_id, action, timestamp) VALUES (NULL, NULL, "barrier_close", NOW())', 
    (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Barrier closed successfully' });
    });
});

// Function to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}