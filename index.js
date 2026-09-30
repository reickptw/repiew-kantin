const express = require('express');
const cors = require('cors');
const { sql, poolPromise } = require('./config/db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// 1. USERS (GET list, POST)
// ==========================================
app.get('/users', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT id, name, email, role, created_at FROM dbo.USERS');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/users', async (req, res) => {
  const { name, email, password_hash, role } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, password_hash)
      .input('role', sql.NVarChar, role)
      .query('INSERT INTO dbo.USERS (name, email, password_hash, role) OUTPUT INSERTED.* VALUES (@name, @email, @password_hash, @role)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. STALLS (Full CRUD + Filtering + Pagination)
// ==========================================
app.get('/stalls', async (req, res) => {
  const { category, page = 1, limit = 5 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const pool = await poolPromise;
    let query = 'SELECT * FROM dbo.STALLS';
    const request = pool.request();

    if (category) {
      query += ' WHERE category = @category';
      request.input('category', sql.NVarChar, category);
    }

    query += ' ORDER BY id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    request.input('offset', sql.Int, parseInt(offset));
    request.input('limit', sql.Int, parseInt(limit));

    const result = await request.query(query);
    res.json({ success: true, page: parseInt(page), limit: parseInt(limit), data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/stalls', async (req, res) => {
  const { owner_id, name, category, location, description } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('owner_id', sql.Int, owner_id)
      .input('name', sql.NVarChar, name)
      .input('category', sql.NVarChar, category)
      .input('location', sql.NVarChar, location)
      .input('description', sql.NVarChar, description)
      .query('INSERT INTO dbo.STALLS (owner_id, name, category, location, description) OUTPUT INSERTED.* VALUES (@owner_id, @name, @category, @location, @description)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/stalls/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, location, description } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('category', sql.NVarChar, category)
      .input('location', sql.NVarChar, location)
      .input('description', sql.NVarChar, description)
      .query('UPDATE dbo.STALLS SET name=@name, category=@category, location=@location, description=@description OUTPUT INSERTED.* WHERE id=@id');
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/stalls/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.STALLS WHERE id=@id');
    res.json({ success: true, message: 'Stall deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. MENU_ITEMS (Full CRUD + JOIN stall)
// ==========================================
app.get('/menu-items', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT m.*, s.name AS stall_name 
      FROM dbo.MENU_ITEMS m 
      JOIN dbo.STALLS s ON m.stall_id = s.id
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/menu-items', async (req, res) => {
  const { stall_id, name, price, is_available } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('stall_id', sql.Int, stall_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Int, price)
      .input('is_available', sql.Bit, is_available)
      .query('INSERT INTO dbo.MENU_ITEMS (stall_id, name, price, is_available) OUTPUT INSERTED.* VALUES (@stall_id, @name, @price, @is_available)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. REVIEWS (GET, POST, DELETE + JOIN user)
// ==========================================
app.get('/reviews', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT r.*, u.name AS reviewer_name, u.email AS reviewer_email 
      FROM dbo.REVIEWS r 
      JOIN dbo.USERS u ON r.user_id = u.id
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/reviews', async (req, res) => {
  const { stall_id, user_id, rating, comment } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('stall_id', sql.Int, stall_id)
      .input('user_id', sql.Int, user_id)
      .input('rating', sql.Int, rating)
      .input('comment', sql.NVarChar, comment)
      .query('INSERT INTO dbo.REVIEWS (stall_id, user_id, rating, comment) OUTPUT INSERTED.* VALUES (@stall_id, @user_id, @rating, @comment)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/reviews/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.REVIEWS WHERE id=@id');
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. LIKES (POST, DELETE)
// ==========================================
app.post('/likes', async (req, res) => {
  const { review_id, user_id } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('review_id', sql.Int, review_id)
      .input('user_id', sql.Int, user_id)
      .query('INSERT INTO dbo.LIKES (review_id, user_id) OUTPUT INSERTED.* VALUES (@review_id, @user_id)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/likes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.LIKES WHERE id=@id');
    res.json({ success: true, message: 'Like removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. FLAGS (GET, PUT update status)
// ==========================================
app.get('/flags', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM dbo.FLAGS');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/flags/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query('UPDATE dbo.FLAGS SET status=@status OUTPUT INSERTED.* WHERE id=@id');
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 7. AUDIT_LOGS (GET, POST)
// ==========================================
app.get('/audit-logs', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM dbo.AUDIT_LOGS');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/audit-logs', async (req, res) => {
  const { user_id, action, target_table, target_id, metadata } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('action', sql.NVarChar, action)
      .input('target_table', sql.NVarChar, target_table)
      .input('target_id', sql.Int, target_id)
      .input('metadata', sql.NVarChar, metadata)
      .query('INSERT INTO dbo.AUDIT_LOGS (user_id, action, target_table, target_id, metadata) OUTPUT INSERTED.* VALUES (@user_id, @action, @target_table, @target_id, @metadata)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
