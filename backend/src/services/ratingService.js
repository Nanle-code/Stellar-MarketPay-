/**
 * src/services/ratingService.js
 */
"use strict";

const pool = require("../db/pool");

async function createRating({ jobId, raterAddress, ratedAddress, stars, review }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO ratings (job_id, rater_address, rated_address, stars, review)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_id, rater_address) DO NOTHING
       RETURNING *`,
      [jobId, raterAddress, ratedAddress, stars, review || null]
    );

    if (!rows.length) {
      const e = new Error("Rating already submitted for this job");
      e.status = 409;
      throw e;
    }

    // Recalculate and persist average rating on the profile
    await client.query(
      `UPDATE profiles
       SET rating = (
         SELECT ROUND(AVG(stars)::numeric, 2)
         FROM ratings WHERE rated_address = $1
       )
       WHERE public_key = $1`,
      [ratedAddress]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getRatingsForUser(publicKey) {
  const { rows } = await pool.query(
    `SELECT * FROM ratings WHERE rated_address = $1 ORDER BY created_at DESC`,
    [publicKey]
  );
  return rows;
}

module.exports = { createRating, getRatingsForUser };
