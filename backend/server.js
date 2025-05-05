// server.js - Complete Express server with Socket.io integration
const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Configure Express middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Update with your actual password
  database: 'testdb'
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

// Function to notify clients about database changes
function notifyClients(eventType, data) {
  console.log(`🔔 Emitting ${eventType} event:`, data);
  io.emit('db_change', { event: eventType, payload: data });
}

// Setup Socket.io connection event
io.on('connection', (socket) => {
  console.log('👤 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 Client disconnected:', socket.id);
  });
});

// API Routes
// Get all records
app.get('/records', (req, res) => { 
  db.query('SELECT * FROM records', (err, results) => {
    if (err) {
      console.error('Error fetching records:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// Create a record
app.post('/records', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  console.log('📝 Adding new record:', { name });
  
  db.query('INSERT INTO records (name) VALUES (?)', [name], (err, result) => {
    if (err) {
      console.error('Error creating record:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    const newRecord = { id: result.insertId, name };
    notifyClients('added', newRecord);
    res.status(201).json(newRecord);
  });
});

// Update a record
app.put('/records/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  console.log('✏️ Updating record:', { id, name });
  
  db.query('UPDATE records SET name = ? WHERE id = ?', [name, id], (err, result) => {
    if (err) {
      console.error('Error updating record:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const updatedRecord = { id: parseInt(id), name };
    notifyClients('updated', updatedRecord);
    res.json(updatedRecord);
  });
});

// Delete a record
app.delete('/records/:id', (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ Deleting record:', { id });
  
  db.query('DELETE FROM records WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting record:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    notifyClients('deleted', { id: parseInt(id) });
    res.json({ id: parseInt(id) });
  });
});

// Create user account
app.post('/api/users', upload.single('p_pic'), async (req, res) => {
  const {
    email, username, role, password,
    employee_number, f_name, l_name
  } = req.body;

  const p_pic = req.file ? req.file.filename : null;

  if (!email || !username || !role || !password || !f_name || !l_name) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    // Check for duplicate email or username
    const [existingUsers] = await db.promise().query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email or username already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users 
      (email, username, role, password, employee_number, f_name, l_name, p_pic, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.promise().query(sql, [
      email, username, role, hashedPassword,
      employee_number || null, f_name, l_name, p_pic
    ]);

    const newUser = {
      id: result.insertId,
      email, username, role,
      employee_number, f_name, l_name,
      p_pic
    };

    notifyClients('user_created', newUser);
    res.status(201).json(newUser);

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error during user creation' });
  }
});

// User Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and Password are required' });
  }

  try {
    const [results] = await db.promise().query('SELECT * FROM users WHERE username = ?', [username]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Optional: exclude sensitive data
    delete user.password;

    const userData = {
      f_name: user.f_name,
      p_pic: user.p_pic,
      username: user.username,
      role: user.role
    };

    res.json({ message: 'Login successful', user: userData });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);  
}); 