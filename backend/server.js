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
  database: 'earist_mobilehris'
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
// ===== LEAVE REQUEST ENDPOINTS =====
// Get all leave requests
app.get('/leave_requests', (req, res) => {
  db.query('SELECT * FROM leave_request', (err, results) => {
    if (err) {
      console.error('Error fetching leave requests:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// Update leave request status only
app.put('/leave_requests/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  // Get leave_request first to get employee_id
  db.query('SELECT * FROM leave_request WHERE id = ?', [id], (err, leaveRows) => {
    if (err || leaveRows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    const leave = leaveRows[0];
    db.query('UPDATE leave_request SET status = ? WHERE id = ?', [status, id], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      // Insert notification
      db.query('INSERT INTO notification (user_id, leave_request_id, status) VALUES (?, ?, ?)', [leave.employee_id, id, status], (err, notifResult) => {
        if (err) {
          return res.status(500).json({ error: 'Notification insert error', details: err.message });
        }
        // Join notification + user + leave_request for socket event
        db.query(`SELECT n.*, u.f_name, u.l_name, u.username, u.email, u.role, u.p_pic, l.leave_type, l.start_date, l.end_date FROM notification n
          JOIN users u ON n.user_id = u.id
          JOIN leave_request l ON n.leave_request_id = l.id
          WHERE n.id = ?`, [notifResult.insertId], (err, joinRows) => {
          if (!err && joinRows.length > 0) {
            io.emit('notification', joinRows[0]);
          }
        });
        notifyClients('leave_request_status_updated', { id: parseInt(id), status });
        res.json({ id: parseInt(id), status });
      });
    });
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

// Update user profile (edit name and profile picture)
app.put('/api/users/:id', upload.single('p_pic'), async (req, res) => {
  const { id } = req.params;
  const { f_name, l_name } = req.body;
  const p_pic = req.file ? req.file.filename : null;

  if (!f_name || !l_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  try {
    // Check if user exists
    const [users] = await db.promise().query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let updateQuery = 'UPDATE users SET f_name = ?, l_name = ?';
    const params = [f_name, l_name];

    if (p_pic) {
      updateQuery += ', p_pic = ?';
      params.push(p_pic);
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await db.promise().query(updateQuery, params);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error during profile update' });
  }
});

// View user profile
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query('SELECT id, email, username, role, employee_number, f_name, l_name, p_pic, created_at FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error during profile fetch' });
  }
});

// Add POST /api/leave-request endpoint
app.post('/api/leave-request', (req, res) => {
  const { employee_id, leave_type, start_date, end_date } = req.body;

  if (!employee_id || !leave_type || !start_date || !end_date) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const sql = `
    INSERT INTO leave_request (employee_id, leave_type, start_date, end_date, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `;
  db.query(sql, [employee_id, leave_type, start_date, end_date], (err, result) => {
    if (err) {
      console.error('Error inserting leave request:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ success: true, id: result.insertId });
  });
});

// Update PUT /api/users/:id to allow updating only the profile picture if only a file is uploaded
app.put('/api/users/:id/pic', upload.single('p_pic'), async (req, res) => {
  const { id } = req.params;
  const p_pic = req.file ? req.file.filename : null;

  if (!p_pic) {
    return res.status(400).json({ error: 'No profile picture uploaded' });
  }

  try {
    const [users] = await db.promise().query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateQuery = 'UPDATE users SET p_pic = ? WHERE id = ?';
    await db.promise().query(updateQuery, [p_pic, id]);

    res.json({ message: 'Profile picture updated successfully' });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ error: 'Server error during profile picture update' });
  }
});

// 3. GET /notifications endpoint (joined)
app.get('/notifications', (req, res) => {
  db.query(`SELECT n.*, u.f_name, u.l_name, u.username, u.email, u.role, u.p_pic, l.leave_type, l.start_date, l.end_date
    FROM notification n
    JOIN users u ON n.user_id = u.id
    JOIN leave_request l ON n.leave_request_id = l.id
    ORDER BY n.created_at DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(rows);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);  
}); 