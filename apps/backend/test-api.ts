/**
 * API Testing Script
 * Tests all endpoints to ensure everything works
 */

const API_BASE = 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  success: boolean;
  status: number;
  message: string;
}

const results: TestResult[] = [];
let authToken = '';
let userId = '';

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  return {
    status: response.status,
    data,
    ok: response.ok,
  };
}

async function test(
  description: string,
  method: string,
  path: string,
  body?: any,
  token?: string,
  expectedStatus = 200,
): Promise<any> {
  console.log(`\n🧪 Testing: ${description}`);

  try {
    const result = await request(method, path, body, token);

    const success = result.status === expectedStatus;

    results.push({
      endpoint: `${method} ${path}`,
      method,
      success,
      status: result.status,
      message: description,
    });

    if (success) {
      console.log(`✅ PASSED (${result.status})`);
      console.log(`   Response:`, JSON.stringify(result.data, null, 2).substring(0, 200));
    } else {
      console.log(`❌ FAILED (Expected ${expectedStatus}, got ${result.status})`);
      console.log(`   Response:`, result.data);
    }

    return result.data;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    results.push({
      endpoint: `${method} ${path}`,
      method,
      success: false,
      status: 0,
      message: error.message,
    });
    return null;
  }
}

async function runTests() {
  console.log('═'.repeat(80));
  console.log('🚀 Si Crypto Platform - API Testing Suite');
  console.log('═'.repeat(80));

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  // ============================================================================
  // 1. HEALTH CHECK
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('📡 HEALTH CHECK');
  console.log('─'.repeat(80));

  await test('GET / - Health check', 'GET', '/');

  // ============================================================================
  // 2. AUTHENTICATION
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('🔐 AUTHENTICATION');
  console.log('─'.repeat(80));

  const registerResponse = await test(
    'POST /auth/register - Register new user',
    'POST',
    '/auth/register',
    {
      email: testEmail,
      password: testPassword,
      fullName: 'Test User',
    },
    undefined,
    201,
  );

  if (registerResponse) {
    authToken = registerResponse.accessToken;
    userId = registerResponse.user?.id;
    console.log(`   📝 User ID: ${userId}`);
    console.log(`   🔑 Auth Token: ${authToken?.substring(0, 20)}...`);
  }

  const loginResponse = await test(
    'POST /auth/login - Login',
    'POST',
    '/auth/login',
    {
      email: testEmail,
      password: testPassword,
    },
  );

  if (loginResponse) {
    authToken = loginResponse.accessToken;
  }

  await test('POST /auth/me - Get current user', 'POST', '/auth/me', {}, authToken);

  // ============================================================================
  // 3. USERS
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('👤 USERS');
  console.log('─'.repeat(80));

  await test('GET /users/me - Get my profile', 'GET', '/users/me', undefined, authToken);

  await test(
    'PATCH /users/me - Update profile',
    'PATCH',
    '/users/me',
    {
      fullName: 'Updated User',
    },
    authToken,
  );

  // ============================================================================
  // 4. WALLETS
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('💼 WALLETS');
  console.log('─'.repeat(80));

  const walletsResponse = await test(
    'POST /wallets - Create wallets',
    'POST',
    '/wallets',
    {},
    authToken,
    201,
  );

  await test('GET /wallets - Get all wallets', 'GET', '/wallets', undefined, authToken);

  await test('GET /wallets/balances - Get all balances', 'GET', '/wallets/balances', undefined, authToken);

  await test('GET /wallets/balances/BTC - Get BTC balance', 'GET', '/wallets/balances/BTC', undefined, authToken);

  await test('GET /wallets/balances/ETH - Get ETH balance', 'GET', '/wallets/balances/ETH', undefined, authToken);

  await test('GET /wallets/balances/USDC - Get USDC balance', 'GET', '/wallets/balances/USDC', undefined, authToken);

  await test('GET /wallets/balances/USDT - Get USDT balance', 'GET', '/wallets/balances/USDT', undefined, authToken);

  const btcAddressResponse = await test(
    'GET /wallets/bitcoin/address - Get Bitcoin address',
    'GET',
    '/wallets/bitcoin/address',
    undefined,
    authToken,
  );

  const ethAddressResponse = await test(
    'GET /wallets/ethereum/address - Get Ethereum address',
    'GET',
    '/wallets/ethereum/address',
    undefined,
    authToken,
  );

  // ============================================================================
  // 5. TRANSACTIONS
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('💸 TRANSACTIONS');
  console.log('─'.repeat(80));

  // NOTE: This will fail because user has 0 balance - expected
  await test(
    'POST /transactions/send - Send BTC (should fail - insufficient funds)',
    'POST',
    '/transactions/send',
    {
      token: 'BTC',
      toAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amount: '0.0001',
    },
    authToken,
    400,
  );

  await test('GET /transactions - Get transaction history', 'GET', '/transactions', undefined, authToken);

  // ============================================================================
  // 6. ERROR HANDLING
  // ============================================================================
  console.log('\n' + '─'.repeat(80));
  console.log('⚠️  ERROR HANDLING');
  console.log('─'.repeat(80));

  await test('POST /auth/register - Duplicate email (should fail)', 'POST', '/auth/register', {
    email: testEmail,
    password: testPassword,
    fullName: 'Duplicate User',
  }, undefined, 409);

  await test('POST /auth/login - Wrong password (should fail)', 'POST', '/auth/login', {
    email: testEmail,
    password: 'WrongPassword123!',
  }, undefined, 401);

  await test('GET /wallets - No auth token (should fail)', 'GET', '/wallets', undefined, undefined, 401);

  await test('POST /wallets - Invalid data (should fail)', 'POST', '/wallets', {
    invalidField: 'test',
  }, authToken, 400);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.endpoint} - ${r.message} (Status: ${r.status})`);
    });
  }

  console.log('\n' + '═'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
