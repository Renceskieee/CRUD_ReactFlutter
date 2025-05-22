// App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';

const RECORDS_API = 'http://192.168.99.139:3000/records';
const USERS_API = 'http://192.168.99.139:3000/api/users';
const SOCKET_URL = 'http://192.168.99.139:3000';
const LEAVE_REQUESTS_API = 'http://192.168.99.139:3000/leave_requests';

function App() {
  // ===== TOGGLE STATE =====
  const [mode, setMode] = useState('leave'); // 'leave' or 'account'

  // ===== LEAVE REQUESTS STATE =====
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveError, setLeaveError] = useState(null);
  const [leaveSuccess, setLeaveSuccess] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [statusEditId, setStatusEditId] = useState(null);
  const [statusValue, setStatusValue] = useState('');

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
      fetchLeaveRequests();
      if (data.event && data.event.startsWith('user')) {
        setUserSuccess(`User ${data.event} successfully!`);
        setTimeout(() => setUserSuccess(null), 3000);
      } else if (data.event && data.event.startsWith('leave_request')) {
        setLeaveSuccess('Leave request status updated!');
        setTimeout(() => setLeaveSuccess(null), 3000);
      }
    });

    return () => socket.disconnect();
  }, []);

  // ===== LEAVE REQUESTS HANDLERS =====
  const fetchLeaveRequests = async () => {
    try {
      setLeaveLoading(true);
      const res = await axios.get(LEAVE_REQUESTS_API);
      setLeaveRequests(res.data);
      setLeaveError(null);
    } catch (err) {
      setLeaveError(`Error fetching leave requests: ${err.message}`);
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'leave') fetchLeaveRequests();
  }, [mode]);

  const handleStatusEdit = (id, currentStatus) => {
    setStatusEditId(id);
    setStatusValue(currentStatus);
  };

  const handleStatusChange = (e) => {
    setStatusValue(e.target.value);
  };

  const handleStatusUpdate = async (id) => {
    try {
      setLeaveLoading(true);
      await axios.put(`${LEAVE_REQUESTS_API}/${id}`, { status: statusValue });
      setLeaveSuccess('Status updated successfully!');
      setStatusEditId(null);
      fetchLeaveRequests();
    } catch (err) {
      setLeaveError(err.response?.data?.error || err.message);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleCancelStatusEdit = () => {
    setStatusEditId(null);
    setStatusValue('');
  };

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

  // ===== COLOR PALETTE =====
  const CREAM = '#FEF9E1';
  const BEIGE = '#E5D0AC';
  const RED = '#A31D1D';
  const DARK = '#6D2323';

  // ===== IMAGE PREVIEW STATE =====
  const [previewUrl, setPreviewUrl] = useState(null);

  // ===== USER FORM HANDLERS (with preview) =====
  const handleUserChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'p_pic' && files && files[0]) {
      setFormData({
        ...formData,
        [name]: files[0],
      });
      setPreviewUrl(URL.createObjectURL(files[0]));
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
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

  // ===== DATE FORMATTER =====
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  }
  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
  }

  // ===== STYLES =====
  const containerStyle = {
    minHeight: '100vh',
    width: '100vw',
    background: CREAM,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    fontFamily: 'Segoe UI, Arial, sans-serif',
    overflowX: 'hidden',
  };
  const mainContentStyle = {
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '40px 16px 60px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box',
  };
  const headerStyle = {
    width: '100%',
    textAlign: 'center',
    fontSize: '2.5rem',
    fontWeight: 'bold',
    letterSpacing: '1px',
    color: DARK,
    marginTop: '40px',
    marginBottom: '18px',
    textShadow: '0 2px 8px #E5D0AC',
  };
  const cardStyle = {
    width: '100%',
    maxWidth: '900px',
    background: '#fff',
    border: `2px solid ${BEIGE}`,
    borderRadius: '18px',
    padding: '40px 32px',
    boxShadow: '0 6px 32px rgba(163,29,29,0.08)',
    marginTop: '30px',
    marginBottom: '40px',
    minHeight: '400px',
  };
  const switchStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    marginTop: '20px',
    marginBottom: '10px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(163,29,29,0.04)',
    background: BEIGE,
    width: 'fit-content',
    marginLeft: 'auto',
    marginRight: 'auto',
  };
  const switchBtn = (active) => ({
    padding: '14px 44px',
    border: 'none',
    background: active ? RED : 'transparent',
    color: active ? '#fff' : DARK,
    fontWeight: 'bold',
    fontSize: '19px',
    cursor: 'pointer',
    outline: 'none',
    borderBottom: active ? `4px solid ${BEIGE}` : '4px solid transparent',
    transition: 'background 0.2s, color 0.2s',
    letterSpacing: '0.5px',
  });
  const dividerStyle = {
    width: '100%',
    height: '2px',
    background: `linear-gradient(90deg, ${CREAM} 0%, ${RED} 50%, ${CREAM} 100%)`,
    margin: '32px 0 32px 0',
    border: 'none',
  };
  const tableWrapper = {
    width: '100%',
    marginTop: '18px',
    borderRadius: '10px',
    boxShadow: '0 2px 12px rgba(163,29,29,0.04)',
    background: CREAM,
  };
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '1.08rem',
    background: CREAM,
    borderRadius: '10px',
    overflow: 'hidden',
  };
  const thtd = {
    border: `1.5px solid ${BEIGE}`,
    padding: '14px 8px',
    textAlign: 'center',
    background: BEIGE,
    fontWeight: 500,
    fontSize: '1.08rem',
    letterSpacing: '0.2px',
    color: DARK,
  };
  const thSticky = {
    ...thtd,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: RED,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.13rem',
    boxShadow: `0 2px 6px ${BEIGE}`,
  };
  const badge = (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderRadius: '14px',
    fontWeight: 'bold',
    fontSize: '1rem',
    color: status === 'Approved' ? '#fff' : status === 'Rejected' ? '#fff' : '#fff',
    background: status === 'Approved' ? DARK : status === 'Rejected' ? RED : BEIGE,
    minWidth: '90px',
    justifyContent: 'center',
    border: status === 'Pending' ? `1.5px solid ${RED}` : 'none',
  });
  const inputStyle = { width: '100%', padding: '13px', marginBottom: '18px', borderRadius: '7px', border: `1.5px solid ${BEIGE}`, fontSize: '1.08rem', outline: 'none', transition: 'border 0.2s', background: CREAM, color: DARK };
  const buttonStyle = { padding: '12px 24px', backgroundColor: RED, color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 'bold', fontSize: '1.08rem', cursor: 'pointer', marginTop: '10px', transition: 'background 0.2s', boxShadow: '0 2px 8px #E5D0AC' };
  const buttonGray = { ...buttonStyle, backgroundColor: DARK };
  const spinner = <div style={{ textAlign: 'center', margin: '30px 0' }}><div className="lds-dual-ring"></div></div>;
  const messageBox = (msg, color) => (
    <div style={{ background: color, color: '#fff', padding: '14px', borderRadius: '10px', textAlign: 'center', marginBottom: '22px', fontWeight: 'bold', fontSize: '1.08rem', letterSpacing: '0.2px' }}>{msg}</div>
  );
  // Spinner CSS
  const spinnerCSS = `
    .lds-dual-ring {
      display: inline-block;
      width: 44px;
      height: 44px;
    }
    .lds-dual-ring:after {
      content: " ";
      display: block;
      width: 36px;
      height: 36px;
      margin: 4px;
      border-radius: 50%;
      border: 5px solid ${RED};
      border-color: ${RED} transparent ${RED} transparent;
      animation: lds-dual-ring 1.2s linear infinite;
    }
    @keyframes lds-dual-ring {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <div style={containerStyle}>
      <style>{spinnerCSS}</style>
      <div style={mainContentStyle}>
        <div style={headerStyle}>HRIS Management</div>
        {/* ===== Switch Button ===== */}
        <div style={switchStyle}>
          <button style={switchBtn(mode === 'leave')} onClick={() => setMode('leave')}>Update Leave Request</button>
          <button style={switchBtn(mode === 'account')} onClick={() => setMode('account')}>Create Account</button>
        </div>
        <hr style={dividerStyle} />
        {/* ===== Card ===== */}
        <div style={cardStyle}>
          {mode === 'leave' && (
            <div>
              <h2 style={{textAlign:'center',marginBottom:'22px',fontWeight:'bold',color:'#A31D1D',fontSize:'2rem'}}>Leave Requests</h2>
              {leaveError && messageBox(leaveError, '#e74c3c')}
              {leaveSuccess && messageBox(leaveSuccess, '#27ae60')}
              {leaveLoading ? (
                spinner
              ) : (
                <div style={tableWrapper}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thSticky}>ID</th>
                        <th style={thSticky}>Employee ID</th>
                        <th style={thSticky}>Leave Type</th>
                        <th style={thSticky}>Start Date</th>
                        <th style={thSticky}>End Date</th>
                        <th style={thSticky}>Status</th>
                        <th style={thSticky}>Created At</th>
                        <th style={thSticky}>Updated At</th>
                        <th style={thSticky}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((req) => (
                        <tr key={req.id}>
                          <td style={thtd}>{req.id}</td>
                          <td style={thtd}>{req.employee_id}</td>
                          <td style={thtd}>{req.leave_type}</td>
                          <td style={thtd}>{formatDate(req.start_date)}</td>
                          <td style={thtd}>{formatDate(req.end_date)}</td>
                          <td style={thtd}>
                            {statusEditId === req.id ? (
                              <select value={statusValue} onChange={handleStatusChange} style={{ padding: '8px', borderRadius: '7px', fontSize: '1rem', background:'#fff' }}>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            ) : (
                              <span style={badge(req.status)}>
                                {req.status === 'Approved' && <FaCheckCircle color="#1e7e34" />}
                                {req.status === 'Rejected' && <FaTimesCircle color="#b71c1c" />}
                                {req.status === 'Pending' && <FaHourglassHalf color="#555" />}
                                {req.status}
                              </span>
                            )}
                          </td>
                          <td style={thtd}>{formatDateTime(req.created_at)}</td>
                          <td style={thtd}>{formatDateTime(req.updated_at)}</td>
                          <td style={thtd}>
                            {statusEditId === req.id ? (
                              <>
                                <button onClick={() => handleStatusUpdate(req.id)} style={{ ...buttonStyle, padding: '8px 18px', fontSize: '1rem' }}>Save</button>
                                <button onClick={handleCancelStatusEdit} style={{ ...buttonGray, marginLeft: '8px', padding: '8px 18px', fontSize: '1rem' }}>Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => handleStatusEdit(req.id, req.status)} style={{ ...buttonStyle, padding: '8px 18px', fontSize: '1rem', backgroundColor:'#f1c40f', color:'#222' }}>Edit</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {mode === 'account' && (
            <div>
              <h2 style={{textAlign:'center',marginBottom:'22px',fontWeight:'bold',color:RED,fontSize:'2rem'}}>Create Account</h2>
              {userError && messageBox(userError, RED)}
              {userSuccess && messageBox(userSuccess, DARK)}
              <form onSubmit={handleUserSubmit} encType="multipart/form-data">
                {previewUrl && (
                  <div style={{textAlign:'center',marginBottom:'18px'}}>
                    <img src={previewUrl} alt="Preview" style={{maxWidth:'120px',maxHeight:'120px',borderRadius:'50%',border:`2.5px solid ${RED}`,objectFit:'cover',boxShadow:'0 2px 8px #E5D0AC'}} />
                  </div>
                )}
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
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
