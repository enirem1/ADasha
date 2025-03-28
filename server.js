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
            if (err) return res.status(500).send(err.message);
            if (results.length === 0) return res.status(401).send('User not found');
            
            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).send('Invalid credentials');
            
            const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        });
    } catch (error) {
        res.status(500).send(error.message);
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
    db.query('SELECT * FROM Logs ORDER BY timestamp DESC', (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.json(results);
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
