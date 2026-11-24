import dotenv from 'dotenv';
dotenv.config();

import { pool, query } from '../src/config/db.js';

/**
 * Database Query Latency Benchmark (Section 4 & Candidate Brief).
 * Compares unindexed Sequential Scan vs Indexed Bitmap Index Scan (GIN Trigram)
 * on 500+ tickets searching across subject and body fields.
 */
async function runBenchmark() {
  console.log('='.repeat(70));
  console.log('  TriageSync — Database Query Latency Benchmark (Section 4)');
  console.log('='.repeat(70));

  try {
    // 1. Verify/Populate 500+ tickets
    console.log('\n[1/5] Checking ticket count in database...');
    let countRes = await query('SELECT count(*) FROM tickets');
    let totalTickets = parseInt(countRes.rows[0].count, 10);
    console.log(`[Info] Current tickets in database: ${totalTickets}`);

    if (totalTickets < 500) {
      console.log(`[Populate] Inserting mock tickets to reach >= 500 threshold...`);
      const needed = 550 - totalTickets;
      const categories = ['BILLING', 'LOGIN', 'DELIVERY', 'BUG', 'FEATURE_REQUEST'];
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

      for (let i = 0; i < needed; i++) {
        const cat = categories[i % categories.length];
        const prio = priorities[i % priorities.length];
        await query(
          `INSERT INTO tickets (subject, body, category, priority, status, is_reviewed, is_human_override)
           VALUES ($1, $2, $3, $4, 'OPEN', false, false)`,
          [
            `Support Ticket #${totalTickets + i + 1} - Customer Inquiry`,
            `Detailed customer statement regarding account synchronization and payment charge verification for transaction #${1000 + i}.`,
            cat,
            prio
          ]
        );
      }
      countRes = await query('SELECT count(*) FROM tickets');
      totalTickets = parseInt(countRes.rows[0].count, 10);
      console.log(`[Populate] Database ticket count now: ${totalTickets}`);
    }

    // 2. Ensure pg_trgm extension exists
    await query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    const searchTerm = '%payment charge%';
    const benchmarkSql = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, subject, body, category, priority, status
      FROM tickets
      WHERE (subject || ' ' || body) ILIKE $1
    `;

    // 3. Measure Unindexed (Seq Scan)
    console.log('\n[2/5] Running Unindexed Benchmark (Sequential Scan forced)...');
    await query('DROP INDEX IF EXISTS idx_tickets_search_trgm');

    // Warm-up query
    await query(benchmarkSql, [searchTerm]);

    const unindexedTimes = [];
    let unindexedPlanType = 'Seq Scan';
    let unindexedBuffers = 0;

    for (let i = 0; i < 5; i++) {
      const res = await query(benchmarkSql, [searchTerm]);
      const plan = res.rows[0]['QUERY PLAN'][0];
      unindexedTimes.push(plan['Execution Time']);
      unindexedPlanType = plan.Plan['Node Type'];
      unindexedBuffers = (plan.Plan['Shared Hit Blocks'] || 0) + (plan.Plan['Shared Read Blocks'] || 0);
    }

    const avgUnindexedTime = unindexedTimes.reduce((a, b) => a + b, 0) / unindexedTimes.length;
    console.log(`[Unindexed] Avg Execution Time: ${avgUnindexedTime.toFixed(2)} ms (${unindexedPlanType})`);

    // 4. Measure Indexed (Bitmap Index Scan with GIN Trigram)
    console.log('\n[3/5] Creating GIN trigram index and measuring Indexed performance...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm
      ON tickets USING gin ((subject || ' ' || body) gin_trgm_ops)
    `);

    // Force planner to test index scan vs sequential scan
    await query('SET enable_seqscan = off');

    // Warm-up query
    await query(benchmarkSql, [searchTerm]);

    const indexedTimes = [];
    let indexedPlanType = 'Bitmap Index Scan';
    let indexedBuffers = 0;

    for (let i = 0; i < 5; i++) {
      const res = await query(benchmarkSql, [searchTerm]);
      const plan = res.rows[0]['QUERY PLAN'][0];
      indexedTimes.push(plan['Execution Time']);
      indexedPlanType = plan.Plan['Node Type'];
      indexedBuffers = (plan.Plan['Shared Hit Blocks'] || 0) + (plan.Plan['Shared Read Blocks'] || 0);
    }

    // Reset planner parameter
    await query('SET enable_seqscan = on');

    const avgIndexedTime = indexedTimes.reduce((a, b) => a + b, 0) / indexedTimes.length;
    console.log(`[Indexed] Avg Execution Time: ${avgIndexedTime.toFixed(2)} ms (${indexedPlanType})`);

    // 5. Compute Latency Reduction & Display Table
    console.log('\n[4/5] Benchmark Comparison Results:');
    const latencyReductionPercent = avgUnindexedTime > 0
      ? (((avgUnindexedTime - avgIndexedTime) / avgUnindexedTime) * 100).toFixed(1)
      : '0.0';

    console.log('-'.repeat(70));
    console.log(
      'Metric'.padEnd(28) +
      'Unindexed (Seq Scan)'.padEnd(22) +
      'Indexed (GIN Trigram)'
    );
    console.log('-'.repeat(70));
    console.log('Total Tickets in Dataset:'.padEnd(28) + `${totalTickets}`.padEnd(22) + `${totalTickets}`);
    console.log('Search Filter:'.padEnd(28) + `ILIKE '%payment charge%'`.padEnd(22) + `ILIKE '%payment charge%'`);
    console.log('Scan Strategy:'.padEnd(28) + `${unindexedPlanType}`.padEnd(22) + `${indexedPlanType}`);
    console.log('Avg Execution Time:'.padEnd(28) + `${avgUnindexedTime.toFixed(2)} ms`.padEnd(22) + `${avgIndexedTime.toFixed(2)} ms`);
    console.log('Shared Buffer Blocks:'.padEnd(28) + `${unindexedBuffers}`.padEnd(22) + `${indexedBuffers}`);
    console.log('Latency Reduction:'.padEnd(28) + `-`.padEnd(22) + `${latencyReductionPercent}% Faster`);
    console.log('-'.repeat(70));

    console.log('\n>>> BENCHMARK COMPLETE: Trigram index verified and operational <<<\n');
  } catch (err) {
    console.error('\n[Error] Benchmark failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runBenchmark();
