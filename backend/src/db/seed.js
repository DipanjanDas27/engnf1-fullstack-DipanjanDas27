import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

/**
 * Idempotent database seed script.
 * Conforms strictly to Section 6.1 of the Candidate Brief.
 * Running multiple times creates zero duplicate records.
 */
export const seedDatabase = async () => {
  console.log('Seeding TriageSync database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed Mandatory Accounts (Section 6.1)
    const adminSalt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', adminSalt);

    const userSalt = await bcrypt.genSalt(10);
    const userPasswordHash = await bcrypt.hash('User@123', userSalt);

    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       ON CONFLICT (LOWER(email)) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['Admin Lead', 'admin@triagesync.test', adminPasswordHash, 'ADMIN']
    );
    const adminId = adminRes.rows[0].id;

    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       ON CONFLICT (LOWER(email)) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['Agent Demo', 'user@triagesync.test', userPasswordHash, 'USER']
    );
    const userId = userRes.rows[0].id;

    // 2. Seed Mandatory Resources (≥6 resources: ≥2 ROOM, ≥2 LAB, ≥2 EQUIPMENT, with ≥1 inactive)
    const resources = [
      { name: 'Conference Room Apollo', type: 'ROOM', capacity: 20, description: 'Primary conference room with AV equipment', isActive: true },
      { name: 'Meeting Suite Gemini', type: 'ROOM', capacity: 10, description: 'Executive meeting and interview space', isActive: true },
      { name: 'Electronics Debug Lab', type: 'LAB', capacity: 8, description: 'Hardware diagnostics and testing lab', isActive: true },
      { name: 'Cleanroom Testing Chamber', type: 'LAB', capacity: 4, description: 'Isolated cleanroom environment (currently undergoing calibration)', isActive: false },
      { name: 'Spectrum Analyzer Rig', type: 'EQUIPMENT', capacity: 2, description: 'RF waveform and signal analyzer', isActive: true },
      { name: 'Precision 3D Scanner', type: 'EQUIPMENT', capacity: 1, description: 'Sub-millimeter optical component inspection scanner', isActive: true }
    ];

    for (const r of resources) {
      await client.query(
        `INSERT INTO resources (name, type, capacity, description, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (LOWER(name)) DO UPDATE
         SET type = EXCLUDED.type, capacity = EXCLUDED.capacity, description = EXCLUDED.description, is_active = EXCLUDED.is_active`,
        [r.name, r.type, r.capacity, r.description, r.isActive]
      );
    }

    // 3. Seed Mandatory Support Tickets (≥15 tickets, all categories/priorities, ≥1 XSS tag, ≥3 isReviewed=true)
    const tickets = [
      // BILLING
      {
        externalId: 'EXT-1001',
        subject: 'Overcharge on corporate invoice',
        body: 'We noticed an unexpected charge on our latest monthly invoice. Requesting a full refund for the duplicate payment.',
        autoCategory: 'BILLING',
        category: 'BILLING',
        priority: 'HIGH',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-1002',
        subject: 'Annual subscription payment receipt request',
        body: 'Please provide the tax invoice and VAT breakdown for our latest annual renewal payment.',
        autoCategory: 'BILLING',
        category: 'BILLING',
        priority: 'MEDIUM',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      // Reviewed Ticket 1 (Billing)
      {
        externalId: 'EXT-1003',
        subject: 'Credit card refund confirmation required',
        body: 'Agent verified the duplicate transaction and processed credit refund.',
        autoCategory: 'BILLING',
        category: 'BILLING',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        isHumanOverride: true,
        isReviewed: true,
        assigneeId: userId
      },
      // LOGIN
      {
        externalId: 'EXT-2001',
        subject: 'Locked out of engineer portal',
        body: 'Production down and lead developer locked out after 2fa failure. Need urgent reset immediately.',
        autoCategory: 'LOGIN',
        category: 'LOGIN',
        priority: 'URGENT',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-2002',
        subject: 'Reset single sign on credentials',
        body: 'Employee forgotten password for the SSO portal. Requesting a sign in verification link.',
        autoCategory: 'LOGIN',
        category: 'LOGIN',
        priority: 'MEDIUM',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      // Reviewed Ticket 2 (Login)
      {
        externalId: 'EXT-2003',
        subject: 'Security team cleared 2fa reset',
        body: 'Agent assisted user with hardware key reset and identity verification.',
        autoCategory: 'LOGIN',
        category: 'LOGIN',
        priority: 'MEDIUM',
        status: 'RESOLVED',
        isHumanOverride: true,
        isReviewed: true,
        assigneeId: adminId
      },
      // DELIVERY
      {
        externalId: 'EXT-3001',
        subject: 'My package has not arrived',
        body: 'Tracking indicates delivered yesterday morning but package has not arrived at loading dock.',
        autoCategory: 'DELIVERY',
        category: 'DELIVERY',
        priority: 'HIGH',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-3002',
        subject: 'Replacement diagnostic probe delivery status',
        body: 'Expedited shipping tracking number is showing no updates for 48 hours.',
        autoCategory: 'DELIVERY',
        category: 'DELIVERY',
        priority: 'MEDIUM',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      // BUG
      {
        externalId: 'EXT-4001',
        subject: 'Critical production 500 error on checkout',
        body: 'System crash throwing unhandled 500 exception when customers submit order. Urgent production down situation.',
        autoCategory: 'BUG',
        category: 'BUG',
        priority: 'URGENT',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-4002',
        subject: 'Dashboard broken table formatting',
        body: 'Column headers misaligned on Firefox browser after latest release.',
        autoCategory: 'BUG',
        category: 'BUG',
        priority: 'LOW',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      // Reviewed Ticket 3 (Bug)
      {
        externalId: 'EXT-4003',
        subject: 'Hotfix deployed for memory leak',
        body: 'Agent verified the bug fix patch on staging server and moved status to resolved.',
        autoCategory: 'BUG',
        category: 'BUG',
        priority: 'HIGH',
        status: 'RESOLVED',
        isHumanOverride: false,
        isReviewed: true,
        assigneeId: userId
      },
      // FEATURE_REQUEST
      {
        externalId: 'EXT-5001',
        subject: 'Dark mode theme toggle support',
        body: 'Would love to have an automated dark mode theme option based on OS system preferences.',
        autoCategory: 'FEATURE_REQUEST',
        category: 'FEATURE_REQUEST',
        priority: 'LOW',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-5002',
        subject: 'Bulk export tickets to CSV',
        body: 'Managers need a feature to export monthly triage reports to spreadsheet format.',
        autoCategory: 'FEATURE_REQUEST',
        category: 'FEATURE_REQUEST',
        priority: 'MEDIUM',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-5003',
        subject: 'Webhook notifications on ticket triage',
        body: 'Ability to register outbound webhooks when category or priority changes.',
        autoCategory: 'FEATURE_REQUEST',
        category: 'FEATURE_REQUEST',
        priority: 'MEDIUM',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      },
      {
        externalId: 'EXT-5004',
        subject: 'Customizable ticket queue sort filters',
        body: 'Support engineers would like to save custom sorting preferences in browser localStorage.',
        autoCategory: 'FEATURE_REQUEST',
        category: 'FEATURE_REQUEST',
        priority: 'LOW',
        status: 'CLOSED',
        isHumanOverride: false,
        isReviewed: true
      },
      // MANDATORY XSS-SAFE TEST TICKET (Section 6.1)
      {
        externalId: 'EXT-6001',
        subject: 'Security check: <script>alert("xss-test")</script>',
        body: 'Verifying XSS-safe text escaping: <script>document.cookie="stolen"</script> and <img src=x onerror=alert(1)> must render as sanitized plain text.',
        autoCategory: 'BUG',
        category: 'BUG',
        priority: 'HIGH',
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      }
    ];

    for (const t of tickets) {
      await client.query(
        `INSERT INTO tickets (
          external_id, subject, body, auto_category, category, is_human_override,
          priority, status, assignee_id, is_reviewed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (external_id) DO UPDATE
        SET subject = EXCLUDED.subject,
            body = EXCLUDED.body,
            auto_category = EXCLUDED.auto_category,
            category = CASE WHEN tickets.is_human_override THEN tickets.category ELSE EXCLUDED.category END,
            priority = EXCLUDED.priority,
            status = EXCLUDED.status,
            is_reviewed = EXCLUDED.is_reviewed`,
        [
          t.externalId, t.subject, t.body, t.autoCategory, t.category,
          t.isHumanOverride, t.priority, t.status, t.assigneeId || null, t.isReviewed
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Seed completed successfully: 2 users, ${resources.length} resources, ${tickets.length} tickets seeded.`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database seed:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// Standalone execution support: node src/db/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
