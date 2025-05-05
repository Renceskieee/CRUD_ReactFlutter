// App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const RECORDS_API = 'http://192.168.99.139:3000/records';
const USERS_API = 'http://192.168.99.139:3000/api/users';
const SOCKET_URL = 'http://192.168.99.139:3000';

function App() {
  // ===== RECORDS STATE =====
  const [records, setRecords] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [recordError, setRecordError] = useState(null);
  const [recordSuccess, setRecordSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // ===== ACCOUNT CREATION STATE =====
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    role: 'employee',
    password: '',
    employee_number: '',
    f_name: '',
    l_name: '',
    p_pic: null,
  });
  const [userError, setUserError] = useState(null);
  const [userSuccess, setUserSuccess] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // ===== SOCKET SETUP =====
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('db_change', (data) => {
      fetchRecords();
      if (data.source === 'user') {
        setUserSuccess(`User ${data.event} successfully!`);
        setTimeout(() => setUserSuccess(null), 3000);
      } else {
        setRecordSuccess(`Record ${data.event} successfully!`);
        setTimeout(() => setRecordSuccess(null), 3000);
      }
    });

    return () => socket.disconnect();
  }, []);

  // ===== RECORDS HANDLERS =====
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await axios.get(RECORDS_API);
      setRecords(res.data);
      setRecordError(null);
    } catch (err) {
      setRecordError(`Error fetching records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setRecordError('Name is required.');

    try {
      setLoading(true);
      if (editingId) {
        await axios.put(`${RECORDS_API}/${editingId}`, { name });
      } else {
        await axios.post(RECORDS_API, { name });
      }
      setName('');
      setEditingId(null);
    } catch (err) {
      setRecordError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this record?')) {
      try {
        setLoading(true);
        await axios.delete(`${RECORDS_API}/${id}`);
      } catch (err) {
        setRecordError(err.message);
        fetchRecords();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (record) => {
    setName(record.name);
    setEditingId(record.id);
  };

  const cancelEdit = () => {
    setName('');
    setEditingId(null);
  };

  // ===== USER FORM HANDLERS =====
  const handleUserChange = (e) => {
    const { name, value, files } = e.target;
    setFormData({
      ...formData,
      [name]: files ? files[0] : value,
    });
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      for (const key in formData) {
        data.append(key, formData[key]);
      }
      await axios.post(USERS_API, data);
      setUserSuccess('Account created successfully!');
      setFormData({
        email: '',
        username: '',
        role: 'employee',
        password: '',
        employee_number: '',
        f_name: '',
        l_name: '',
        p_pic: null,
      });
    } catch (err) {
      setUserError(err.response?.data?.error || err.message);
    }
  };

  // ===== STYLES =====
  const containerStyle = {
    display: 'flex',
    gap: '40px',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  };

  const sectionStyle = {
    flex: 1,
    border: '1px solid #ccc',
    padding: '20px',
    borderRadius: '8px',
  };

  const dividerStyle = {
    width: '2px',
    backgroundColor: '#ccc',
  };

  const inputStyle = { width: '100%', padding: '8px', marginBottom: '10px' };
  const buttonStyle = { padding: '10px', backgroundColor: '#007bff', color: '#fff', border: 'none' };

  return (
    <div style={containerStyle}>
      {/* ===== Left Side - Add Record ===== */}
      <div style={sectionStyle}>
        <h2>Manage Records</h2>
        <div>
          {socketConnected ? '✅ Socket connected' : '❌ Socket disconnected'}
        </div>
        {recordError && <div style={{ color: 'red' }}>{recordError}</div>}
        {recordSuccess && <div style={{ color: 'green' }}>{recordSuccess}</div>}
        <form onSubmit={handleRecordSubmit}>
          <input
            type="text"
            style={inputStyle}
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" style={buttonStyle}>
            {editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={{ ...buttonStyle, backgroundColor: 'gray', marginLeft: '10px' }}>
              Cancel
            </button>
          )}
        </form>
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              {record.name}
              <button onClick={() => handleEdit(record)} style={{ marginLeft: '10px' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} style={{ marginLeft: '5px' }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      {/* ===== Divider ===== */}
      <div style={dividerStyle}></div>

      {/* ===== Right Side - Create Account ===== */}
      <div style={sectionStyle}>
        <h2>Create Account</h2>
        {userError && <div style={{ color: 'red' }}>{userError}</div>}
        {userSuccess && <div style={{ color: 'green' }}>{userSuccess}</div>}
        <form onSubmit={handleUserSubmit} encType="multipart/form-data">
          <input type="text" name="f_name" placeholder="First Name" style={inputStyle} value={formData.f_name} onChange={handleUserChange} />
          <input type="text" name="l_name" placeholder="Last Name" style={inputStyle} value={formData.l_name} onChange={handleUserChange} />
          <input type="email" name="email" placeholder="Email" style={inputStyle} value={formData.email} onChange={handleUserChange} />
          <input type="text" name="username" placeholder="Username" style={inputStyle} value={formData.username} onChange={handleUserChange} />
          <input type="password" name="password" placeholder="Password" style={inputStyle} value={formData.password} onChange={handleUserChange} />
          <input type="text" name="employee_number" placeholder="Employee Number" style={inputStyle} value={formData.employee_number} onChange={handleUserChange} />
          <select name="role" style={inputStyle} value={formData.role} onChange={handleUserChange}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <input type="file" name="p_pic" style={inputStyle} onChange={handleUserChange} />
          <button type="submit" style={buttonStyle}>Create Account</button>
        </form>
      </div>
    </div>
  );
}

export default App;
