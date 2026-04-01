const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      phien INTEGER UNIQUE,
      phien_dudoan INTEGER,
      du_doan VARCHAR(10),
      do_tin_cay TEXT,
      giai_thich TEXT,
      giai_thich_chi_tiet TEXT,
      ty_le_thanh_cong VARCHAR(20),
      streak_hien_tai VARCHAR(50),
      ket_qua VARCHAR(10),
      dung_sai VARCHAR(10) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ DB ready');
}

async function upsertPhien(data) {
  // Lưu dự đoán cho phiên tiếp theo
  await pool.query(`
    INSERT INTO history (phien, phien_dudoan, du_doan, do_tin_cay, giai_thich, giai_thich_chi_tiet, ty_le_thanh_cong, streak_hien_tai)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (phien) DO UPDATE SET
      du_doan = EXCLUDED.du_doan,
      do_tin_cay = EXCLUDED.do_tin_cay,
      giai_thich = EXCLUDED.giai_thich,
      giai_thich_chi_tiet = EXCLUDED.giai_thich_chi_tiet,
      ty_le_thanh_cong = EXCLUDED.ty_le_thanh_cong,
      streak_hien_tai = EXCLUDED.streak_hien_tai
  `, [
    data.phien_dudoan,
    data.phien_dudoan,
    data.du_doan_van_sau,
    data.do_tin_cay,
    data.giai_thich,
    data.giai_thich_chi_tiet,
    data.ty_le_thanh_cong,
    data.thong_ke?.streak_hien_tai || ''
  ]);

  // Cập nhật kết quả thực tế cho phiên vừa xong
  const res = await pool.query(
    `SELECT du_doan FROM history WHERE phien = $1`, [data.phien]
  );
  if (res.rows.length > 0) {
    const ket_qua = data.ket_qua_hien_tai;
    const dung_sai = res.rows[0].du_doan === ket_qua ? 'dung' : 'sai';
    await pool.query(`
      UPDATE history SET ket_qua = $1, dung_sai = $2 WHERE phien = $3
    `, [ket_qua, dung_sai, data.phien]);
  }
}

async function getHistory(limit = 50) {
  const res = await pool.query(
    `SELECT * FROM history ORDER BY phien DESC LIMIT $1`, [limit]
  );
  return res.rows;
}

module.exports = { initDB, upsertPhien, getHistory };
