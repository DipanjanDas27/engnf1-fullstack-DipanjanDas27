import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app.js';
import { pool, query } from '../src/config/db.js';

/**
 * Concurrency & Race Safety Stress Test (Rule B6 & Section 5).
 * Dispatches 10 simultaneous booking requests for the exact same slot.
 * Asserts exactly 1 succeeds (HTTP 201) and 9 fail with HTTP 409 Conflict.
 */
async function runConcurrencyTest() {
  console.log('='.repeat(70));
  console.log('  TriageSync — Concurrency & Race Safety Stress Test (Rule B6)');
  console.log('='.repeat(70));

  let server;
  let baseUrl = process.env.BASE_URL;

  if (!baseUrl) {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Info] In-process server listening on ephemeral port ${port}`);
  } else {
    console.log(`[Info] Targeting external server at ${baseUrl}`);
  }

  try {
    // 1. Authenticate as regular user
    console.log('\n[1/5] Authenticating test user (user@triagesync.test)...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@triagesync.test',
        password: 'User@123'
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginData)}`);
    }

    const token = loginData.token;
    const userId = loginData.user.id;
    console.log(`[Auth] Authenticated as ${loginData.user.name} (${userId})`);

    // 2. Locate active resource
    console.log('\n[2/5] Locating active test resource...');
    const resRes = await query(
      "SELECT id, name, type, capacity FROM resources WHERE is_active = true LIMIT 1"
    );
    if (resRes.rows.length === 0) {
      throw new Error('No active resources found in database to test.');
    }
    const resource = resRes.rows[0];
    console.log(`[Resource] Selected: "${resource.name}" (${resource.type}, ID: ${resource.id})`);

    // 3. Prepare target 30-min slot 5 days in the future (Rule B1-B4)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    targetDate.setUTCHours(14, 0, 0, 0); // 14:00:00 UTC
    const startTime = targetDate.toISOString();
    targetDate.setUTCMinutes(30); // 14:30:00 UTC
    const endTime = targetDate.toISOString();

    console.log(`\n[3/5] Target Slot: ${startTime} -> ${endTime}`);

    // Clean up any existing bookings for this resource/slot or active bookings for user
    await query(
      'DELETE FROM bookings WHERE resource_id = $1 AND start_time = $2',
      [resource.id, startTime]
    );
    await query(
      "DELETE FROM bookings WHERE user_id = $1 AND start_time > NOW()",
      [userId]
    );
    console.log('[Setup] Cleared conflicting future bookings for user & slot.');

    // 4. Dispatch 10 simultaneous requests
    console.log('\n[4/5] Firing 10 simultaneous booking requests via Promise.all...');
    const CONCURRENT_REQUESTS = 10;
    const startTimeMs = Date.now();

    const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, idx) => {
      const reqNum = idx + 1;
      return fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          resourceId: resource.id,
          startTime,
          endTime,
          purpose: `Stress Test Concurrent Worker #${reqNum}`
        })
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        return {
          worker: reqNum,
          status: response.status,
          success: response.status === 201,
          conflict: response.status === 409,
          data
        };
      });
    });

    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTimeMs;

    console.log(`[Execution] Completed 10 requests in ${durationMs}ms`);

    // 5. Evaluate Results
    console.log('\n[5/5] Analyzing Status Codes and Database State:');
    console.log('-'.repeat(70));
    console.log(
      'Worker #'.padEnd(12) +
      'HTTP Status'.padEnd(16) +
      'Outcome'.padEnd(16) +
      'Detail'
    );
    console.log('-'.repeat(70));

    let createdCount = 0;
    let conflictCount = 0;
    let otherCount = 0;

    results.forEach((r) => {
      let outcome = 'OTHER';
      let detail = '';
      if (r.status === 201) {
        createdCount++;
        outcome = 'SUCCESS';
        detail = `Booking ID: ${r.data?.data?.id || 'OK'}`;
      } else if (r.status === 409) {
        conflictCount++;
        outcome = 'CONFLICT (409)';
        detail = r.data?.error?.message || 'Conflict detected';
      } else {
        otherCount++;
        detail = r.data?.error?.message || JSON.stringify(r.data);
      }

      console.log(
        `Worker ${r.worker}`.padEnd(12) +
        `${r.status}`.padEnd(16) +
        outcome.padEnd(16) +
        detail
      );
    });
    console.log('-'.repeat(70));

    // Verify database record count
    const dbCheck = await query(
      'SELECT count(*) FROM bookings WHERE resource_id = $1 AND start_time = $2',
      [resource.id, startTime]
    );
    const dbBookedCount = parseInt(dbCheck.rows[0].count, 10);

    console.log(`\nResults Summary:`);
    console.log(`  - Total Requests:      ${CONCURRENT_REQUESTS}`);
    console.log(`  - 201 Created:         ${createdCount} (Expected: 1)`);
    console.log(`  - 409 Conflict:        ${conflictCount} (Expected: 9)`);
    console.log(`  - Other Statuses:      ${otherCount} (Expected: 0)`);
    console.log(`  - DB Inserted Rows:    ${dbBookedCount} (Expected: 1)`);

    // Assertions
    const pass201 = createdCount === 1;
    const pass409 = conflictCount === 9;
    const passDB = dbBookedCount === 1;

    if (pass201 && pass409 && passDB) {
      console.log('\n>>> STRESS TEST PASSED: 100% Race Condition Free (1x 201, 9x 409) <<<\n');
    } else {
      console.error('\n>>> STRESS TEST FAILED: Race condition or unexpected response detected! <<<\n');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('\n[Error] Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }
}

runConcurrencyTest();
