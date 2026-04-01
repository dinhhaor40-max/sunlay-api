const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { initDB, upsertPhien, getHistory } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SOURCE_API = 'https://sunlaymaynkx.hacksieucap.pro/ttsunver2';

app.use(cors());
app.use(express.json());

let lastPhien = null;
let latestData = null;

// GET /latest - dữ liệu mới nhất
app.get('/latest', (req, res) => {
  if (!latestData) return res.status(503).json({ error: 'Chưa có dữ liệu' });
  res.json(latestData);
});

// GET /phien - để HTML smart poll
app.get('/phien', (req, res) => {
  if (!latestData) return res.status(503).json({ error: 'Chưa có dữ liệu' });
  res.json({ phien: latestData.phien, phien_dudoan: latestData.phien_dudoan });
});

// GET /history
app.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const rows = await getHistory(limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /stats
app.get('/stats', async (req, res) => {
  try {
    const rows = await getHistory(1000);
    const verified = rows.filter(r => r.dung_sai !== 'pending');
    const dung = verified.filter(r => r.dung_sai === 'dung').length;
    res.json({
      total: rows.length,
      verified: verified.length,
      dung,
      sai: verified.length - dung,
      accuracy: verified.length > 0 ? Math.round(dung / verified.length * 100) + '%' : '--'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto fetch mỗi 3 giây, chỉ lưu DB khi có phiên mới
async function autoFetch() {
  try {
    const r = await fetch(SOURCE_API);
    const data = await r.json();
    latestData = data;

    if (data.phien !== lastPhien) {
      lastPhien = data.phien;
      await upsertPhien(data);
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Phiên mới: ${data.phien} | KQ: ${data.ket_qua_hien_tai} | Dự đoán: ${data.du_doan_van_sau} | ${data.do_tin_cay}`);
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

initDB().then(() => {
  autoFetch();
  setInterval(autoFetch, 3000);
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
