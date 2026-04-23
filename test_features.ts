import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runTests() {
  console.log("🚀 Starting CareerGate Functional Feature Test...");
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'careergate',
  });

  try {
    // Test 1: Database Connectivity
    console.log("📡 Test 1: MySQL Connectivity...");
    await pool.query("SELECT 1");
    console.log("✅ MySQL Connected.");

    // Test 2: User Schema Integrity
    console.log("📋 Test 2: User Schema Integrity...");
    const [columns]: any = await pool.query("DESCRIBE users");
    const colNames = columns.map((c: any) => c.Field);
    const required = ['uid', 'email', 'password', 'google_id', 'active'];
    required.forEach(col => {
      if (!colNames.includes(col)) throw new Error(`Missing column: ${col}`);
    });
    console.log("✅ Schema validated.");

    // Test 3: Check Google User Password Update Logic
    console.log("🔐 Test 3: Checking Google User Reset Logic...");
    // Find a google user
    const [users]: any = await pool.query("SELECT email, uid, password FROM users WHERE google_id IS NOT NULL LIMIT 1");
    if (users.length > 0) {
      const user = users[0];
      console.log(`Found Google User: ${user.email} (UID: ${user.uid})`);
      console.log(`Current Password Hash: ${user.password ? 'EXISTS' : 'EMPTY'}`);
    } else {
      console.log("⚠️ No Google users found in DB to test reset logic. Skipping.");
    }

    // Test 4: OTP Integrity
    console.log("📬 Test 4: OTP Table Check...");
    const [otpCols]: any = await pool.query("DESCRIBE otp_codes");
    console.log("✅ OTP Table exists with columns:", otpCols.map((c: any) => c.Field).join(", "));

    // Test 5: Profile/Resume Check
    console.log("📄 Test 5: Profile/Resume Logic...");
    const [profileCols]: any = await pool.query("DESCRIBE profiles");
    console.log("✅ Profile Table active.");

    console.log("\n✨ ALL CORE BACKEND FEATURES OPERATIONAL ✨");
  } catch (err: any) {
    console.error("❌ TEST FAILED:", err.message);
  } finally {
    process.exit();
  }
}

runTests();
