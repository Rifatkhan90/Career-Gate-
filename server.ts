import { config } from "dotenv";
config({ path: ".env.local" });
console.log('📬 GMAIL_USER:', process.env.GMAIL_USER ? 'Configured' : 'MISSING');
console.log('🔑 GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Configured' : 'MISSING');

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import fs from "fs";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";

// Replace users.json logic with MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'careergate',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'careergate'}\`;`);
    await connection.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        displayName VARCHAR(255),
        role VARCHAR(50) DEFAULT 'candidate',
        active BOOLEAN DEFAULT TRUE,
        photoURL TEXT,
        google_id VARCHAR(255) UNIQUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        salary VARCHAR(255),
        type VARCHAR(255),
        description TEXT,
        requirements TEXT,
        employerId VARCHAR(255),
        status VARCHAR(50),
        postedAt VARCHAR(100),
        matchScore INT DEFAULT NULL,
        approved BOOLEAN DEFAULT FALSE,
        bannerUrl TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(255) PRIMARY KEY,
        jobId VARCHAR(255) NOT NULL,
        jobTitle VARCHAR(255),
        companyName VARCHAR(255),
        candidateId VARCHAR(255) NOT NULL,
        candidateName VARCHAR(255),
        status VARCHAR(50),
        appliedAt VARCHAR(100),
        resumeUrl MEDIUMTEXT,
        description TEXT,
        approvedByAdmin BOOLEAN DEFAULT FALSE
      )
    `);

    // Profiles table - stores bio, profile picture, and resume data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50),
        bio TEXT,
        profilePic MEDIUMTEXT,
        resumeData LONGTEXT,
        resumeUrl MEDIUMTEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Password OTP table for Gmail-based reset
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp CHAR(6) NOT NULL,
        expiresAt DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expiresAt DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE
      )
    `);

    // Only seed users if the table is completely empty
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const hashedAdmin = await bcrypt.hash('admin1', 10);
      const hashedEmployer = await bcrypt.hash('employe27t', 10);
      const hashedCandidate = await bcrypt.hash('candidated', 10);

      await pool.query(`INSERT INTO users (uid, email, password, displayName, role) VALUES ?`, [
        [
          ['admin-001', 'admin@gmail.com', hashedAdmin, 'System Admin', 'admin'],
          ['employer-001', 'employe@gmail.com', hashedEmployer, 'TechCorp Recruiter', 'employer'],
          ['candidate-001', 'candidate@gmail.com', hashedCandidate, 'Job Seeker', 'candidate']
        ]
      ]);
      console.log('✅ Database seeded with encrypted initial users.');
    }

    // ── Column migration: safely add new columns if they don't exist ──────────
    const alterColumns = [
      { table: 'users', col: 'google_id', sql: 'ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE' },
      { table: 'users', col: 'photoURL',  sql: 'ALTER TABLE users MODIFY COLUMN photoURL TEXT' },
      { table: 'profiles', col: 'resumeUrl', sql: 'ALTER TABLE profiles ADD COLUMN resumeUrl MEDIUMTEXT' },
      { table: 'profiles', col: 'profilePic', sql: 'ALTER TABLE profiles ADD COLUMN profilePic MEDIUMTEXT' },
    ];

    for (const item of alterColumns) {
      try {
        const [existingCols]: any = await pool.query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [process.env.DB_NAME || 'careergate', item.table, item.col]
        );
        if (existingCols.length === 0) {
          await pool.query(item.sql);
          console.log(`✅ Migrated: Added ${item.col} to ${item.table}`);
        }
      } catch (err) {
        // Suppress errors for duplicate column adds
      }
    }
    
    console.log('✅ MySQL Database initialized and synchronized.');
  } catch (err: any) {
    console.error('❌ DB Initialization Failed:', err.message);
  }
}
initDB();

// ─── Nodemailer transporter (FREE via Gmail SMTP) ────────────────────────────
function getMailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Passport Google OAuth Strategy ─────────────────────────────────────────
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${APP_URL}/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || '';
      const googleId = profile.id;
      const displayName = profile.displayName || email.split('@')[0];
      const photoURL = profile.photos?.[0]?.value || null;

      // Check if user exists by google_id or email
      const [existingByGoogle]: any = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
      if (existingByGoogle.length > 0) {
        const u = existingByGoogle[0];
        return done(null, { uid: u.uid, email: u.email, displayName: u.displayName, role: u.role, photoURL: u.photoURL });
      }

      const [existingByEmail]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (existingByEmail.length > 0) {
        // Link google_id to existing account
        await pool.query('UPDATE users SET google_id = ?, photoURL = ? WHERE email = ?', [googleId, photoURL, email]);
        const u = existingByEmail[0];
        return done(null, { uid: u.uid, email: u.email, displayName: u.displayName, role: u.role, photoURL });
      }

      // Create new user
      const uid = `google-${Date.now()}`;
      await pool.query(
        'INSERT INTO users (uid, email, password, displayName, role, photoURL, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uid, email, '', displayName, 'candidate', photoURL, googleId]
      );
      return done(null, { uid, email, displayName, role: 'candidate', photoURL });
    } catch (err) {
      return done(err as Error);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));
  console.log('✅ Google OAuth strategy configured.');
} else {
  console.log('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local');
}

// Lazy initialize Stripe to avoid crash if key is missing
let stripeClient: Stripe | null = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  await initDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Session middleware (required for Passport)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'careergate-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  // CORS Middleware
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // ─── Google OAuth Routes ────────────────────────────────────────────────────
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=error' }),
    (req, res) => {
      const user = req.user as any;
      if (user) {
        // Send user data to frontend via a script tag (SPA redirect trick)
        res.send(`
          <script>
            window.opener && window.opener.postMessage({ type: 'google_auth_success', user: ${JSON.stringify(user)} }, '*');
            window.opener ? window.close() : window.location.replace('/');
          </script>
        `);
      } else {
        res.redirect('/?auth=error');
      }
    }
  );

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "CareerGate API is running" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { priceId, planName } = req.body;
      const stripe = getStripe();
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `CareerGate ${planName} Plan`,
              },
              unit_amount: req.body.unit_amount || (priceId === "basic" ? 0 : priceId === "pro" ? 2900 : 9900),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL}?payment=success`,
        cancel_url: `${process.env.APP_URL}?payment=cancel`,
      });

      res.json({ id: session.id });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, displayName, role } = req.body;
    console.log('Backend: Signup request for', email);
    try {
      const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email already registered." });
      }

      const uid = `u-${Date.now()}`;
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.query(
        'INSERT INTO users (uid, email, password, displayName, role) VALUES (?, ?, ?, ?, ?)',
        [uid, email.toLowerCase().trim(), hashedPassword, displayName, role]
      );

      res.json({ uid, email: email.toLowerCase().trim(), displayName, role, photoURL: null });
    } catch (err: any) {
      res.status(500).json({ error: "Signup failed." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    console.log('Backend: Login request for', email);
    try {
      const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      if (!user.active) {
        return res.status(403).json({ error: "Account disabled." });
      }

      const { password: _, id, ...userWithoutPassword } = user;
      res.json({...userWithoutPassword, active: user.active === 1});
    } catch (err: any) {
      res.status(500).json({ error: "Login failed." });
    }
  });

  // ─── OTP-Based Password Reset via Gmail ─────────────────────────────────────

  // Step 1: User submits email → system sends 6-digit OTP to their Gmail
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const normalizedEmail = email.toLowerCase().trim();
    try {
      const [rows]: any = await pool.query('SELECT uid, email FROM users WHERE email = ?', [normalizedEmail]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "No account found with this email address." });
      }

      const uid = rows[0].uid;

      // Generate a secure 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Remove any existing unused OTPs for this user
      await pool.query('DELETE FROM otp_codes WHERE uid = ?', [uid]);
      await pool.query(
        'INSERT INTO otp_codes (uid, email, otp, expiresAt) VALUES (?, ?, ?, ?)',
        [uid, normalizedEmail, otp, expiresAt]
      );

      // Send OTP via Gmail SMTP
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const transporter = getMailTransporter();
          await transporter.sendMail({
            from: `"CareerGate Security" <${process.env.GMAIL_USER}>`,
            to: normalizedEmail,
            subject: `🔐 Your CareerGate OTP: ${otp}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f0f0f;padding:40px;border-radius:20px;color:#fff;">
                <div style="text-align:center;margin-bottom:32px;">
                  <h1 style="font-size:28px;font-style:italic;color:#fff;margin:0;">CareerGate</h1>
                  <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Password Reset Request</p>
                </div>
                <div style="background:#1a1a1a;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;border:1px solid #333;">
                  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;">Your One-Time Password</p>
                  <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#fff;font-family:monospace;">${otp}</div>
                  <p style="color:#555;font-size:12px;margin-top:16px;">Valid for <strong style="color:#aaa;">10 minutes</strong> only. Do not share this with anyone.</p>
                </div>
                <p style="color:#555;font-size:12px;text-align:center;">If you didn't request this, please ignore this email — your password remains unchanged.</p>
              </div>
            `,
          });
          console.log(`✅ OTP sent to ${normalizedEmail}`);
          res.json({ message: `OTP sent to ${normalizedEmail}. Please check your inbox.`, emailSent: true });
        } catch (mailErr: any) {
          console.error('Gmail OTP Send Error:', mailErr.message);
          // Dev fallback — return OTP directly so dev can still use without SMTP
          res.json({ message: "Gmail SMTP not configured. Use this OTP:", otp, dev: true });
        }
      } else {
        // No Gmail configured — development mode
        res.json({ message: "Gmail not configured. OTP for development:", otp, dev: true });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate OTP. Please try again." });
    }
  });

  // Step 2: Verify the OTP the user entered
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required." });
    try {
      const [rows]: any = await pool.query(
        'SELECT uid FROM otp_codes WHERE email = ? AND otp = ? AND expiresAt > NOW() AND used = FALSE',
        [email.toLowerCase().trim(), String(otp).trim()]
      );
      if (rows.length === 0) {
        return res.status(400).json({ error: "Invalid or expired OTP. Please try again or request a new one." });
      }
      // Mark OTP as used immediately
      await pool.query('UPDATE otp_codes SET used = TRUE WHERE email = ? AND otp = ?', [email.toLowerCase().trim(), String(otp).trim()]);
      res.json({ valid: true, uid: rows[0].uid });
    } catch (err) {
      res.status(500).json({ error: "OTP verification failed." });
    }
  });

  // Step 3: Set new password (uid comes from verified OTP)
  app.post("/api/auth/reset-password", async (req, res) => {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) return res.status(400).json({ error: "Missing required fields." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    
    try {
      console.log(`🔐 Attempting password reset for UID: ${uid}`);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update the user's password. This works for both native and Google users.
      const [result]: any = await pool.query('UPDATE users SET password = ? WHERE uid = ?', [hashedPassword, uid]);
      
      if (result.affectedRows === 0) {
        console.error(`❌ Reset failed: No user found with UID ${uid}`);
        return res.status(404).json({ error: "User identity lost. Please try the process again." });
      }

      console.log(`✅ Password updated successfully in MySQL for UID: ${uid}`);
      res.json({ message: "Password updated successfully! You can now sign in with your email and new password." });
    } catch (err: any) {
      console.error('❌ Password Reset Error:', err.message);
      res.status(500).json({ error: "Database error during password reset." });
    }
  });

  // ─── Profile & Resume API ────────────────────────────────────────────────────
  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM profiles WHERE userId = ?', [req.params.userId]);
      res.json(rows[0] || {});
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile/:userId", async (req, res) => {
    try {
      const { role, bio, profilePic, resumeData, resumeUrl } = req.body;
      const userId = req.params.userId;
      await pool.query(`
        INSERT INTO profiles (userId, role, bio, profilePic, resumeData, resumeUrl)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE role=VALUES(role), bio=VALUES(bio), profilePic=VALUES(profilePic), resumeData=VALUES(resumeData), resumeUrl=VALUES(resumeUrl)
      `, [userId, role || 'candidate', bio || '', profilePic || null, resumeData || null, resumeUrl || null]);

      // Also update photoURL in users table if profilePic provided
      if (profilePic) {
        await pool.query('UPDATE users SET photoURL = ? WHERE uid = ?', [profilePic, userId]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save profile" });
    }
  });

  app.get("/api/admin/all-users", async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT uid, email, displayName, role, active, photoURL, password FROM users');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch users." });
    }
  });

  app.post("/api/admin/delete-user/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const [result]: any = await pool.query('DELETE FROM users WHERE uid = ?', [uid]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found in system" });
      }
      res.json({ message: "User successfully erased" });
    } catch (err: any) {
      res.status(500).json({ error: `Critical failure: ${err.message}` });
    }
  });

  app.post("/api/admin/toggle-user-status", async (req, res) => {
    try {
      const { uid, active } = req.body;
      const [result]: any = await pool.query('UPDATE users SET active = ? WHERE uid = ?', [active, uid]);
      if (result.affectedRows > 0) {
        res.json({ message: `User status updated to ${active ? 'Active' : 'Deactivated'}` });
      } else {
        res.status(404).json({ error: "Account lookup failed" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "System mutation failure" });
    }
  });

  // -------------------------------------------------------------
  // Jobs API
  // -------------------------------------------------------------
  app.get("/api/jobs", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM jobs');
      const formatted = (rows as any[]).map(r => ({...r, approved: r.approved === 1}));
      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const job = req.body;
      await pool.query(
        'INSERT INTO jobs (id, title, company, location, salary, type, description, requirements, employerId, status, postedAt, matchScore, approved, bannerUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [job.id, job.title, job.company, job.location, job.salary, job.type, job.description, job.requirements, job.employerId, job.status, job.postedAt, job.matchScore || null, job.approved === true ? 1 : 0, job.bannerUrl || null]
      );
      res.json(job);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add job" });
    }
  });

  app.put("/api/jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      let query = 'UPDATE jobs SET ';
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        query += `${key} = ?, `;
        values.push(val);
      }
      query = query.slice(0, -2) + ' WHERE id = ?';
      values.push(id);
      
      await pool.query(query, values);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await pool.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // -------------------------------------------------------------
  // Applications API
  // -------------------------------------------------------------
  app.get("/api/applications", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM applications');
      const formatted = (rows as any[]).map(r => ({...r, approvedByAdmin: r.approvedByAdmin === 1}));
      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.post("/api/applications", async (req, res) => {
    try {
      const appData = req.body;
      await pool.query(
        'INSERT INTO applications (id, jobId, jobTitle, companyName, candidateId, candidateName, status, appliedAt, resumeUrl, description, approvedByAdmin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [appData.id, appData.jobId, appData.jobTitle, appData.companyName, appData.candidateId, appData.candidateName, appData.status, appData.appliedAt, appData.resumeUrl || null, appData.description || null, appData.approvedByAdmin === true ? 1 : 0]
      );
      res.json(appData);
    } catch (err) {
      res.status(500).json({ error: "Failed to add application" });
    }
  });

  app.put("/api/applications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      let query = 'UPDATE applications SET ';
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        query += `${key} = ?, `;
        values.push(val);
      }
      query = query.slice(0, -2) + ' WHERE id = ?';
      values.push(id);
      
      await pool.query(query, values);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.post("/api/ai/match", async (req, res) => {
    const { resumeText, jobDescription } = req.body;
    res.json({ score: Math.floor(Math.random() * 30) + 70 });
  });

  // Dedicated LM Studio Tunnel to bypass CORS OPTIONS failure
  app.post("/api/v1/chat/completions", async (req, res) => {
    try {
      const aiResponse = await fetch("http://127.0.0.1:1234/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await aiResponse.json();
      res.status(aiResponse.status).json(data);
    } catch (err: any) {
      console.error("AI Tunnel Error:", err.message);
      res.status(500).json({ error: "Local AI integration failed. Ensure LM Studio is active." });
    }
  });

  app.post("/api/ai/parse-resume", async (req, res) => {
    const { resumeText } = req.body;
    // Simulate parsing
    res.json({
      skills: ["React", "TypeScript", "Node.js", "Tailwind CSS"],
      experience: "5 years",
      education: "B.Sc. in Computer Science"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 CAREERGATE SERVER READY`);
    console.log(`   Local host: http://localhost:${PORT}`);
    console.log(`   Database: MySQL (Port 3306)\n`);
  });
}

startServer();
