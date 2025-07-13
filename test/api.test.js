// File: test/api.test.js

// Mock console.log to suppress MongoDB connection logs during testing
const originalConsoleLog = console.log;
console.log = jest.fn();

const request = require('supertest');
const { app } = require('../server');

// Mock the mailer to capture verification tokens
const transporter = require('../mailer');
jest.mock('../mailer');

// Restore console.log after import
console.log = originalConsoleLog;

describe('API Endpoints', () => {
  let token = '';
  let verificationToken = '';

  beforeEach(() => {
    // Reset the mock before each test
    transporter.sendMail.mockClear();
  });

  it('should not signup user : Missing fields', async () => {
    const res = await request(app).post('/auth/signup').send({
      firstName: 'testuser',
      email: 'test@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(400);
  });

  it('should signup user', async () => {
    // Mock the sendMail function to capture the verification URL
    transporter.sendMail.mockImplementation((mailOptions) => {
      // Extract verification token from the email text
      const verificationUrl = mailOptions.text.match(/token=([^&]+)/);
      if (verificationUrl) {
        verificationToken = verificationUrl[1];
      }
      return Promise.resolve({ messageId: 'test-message-id' });
    });

    const res = await request(app).post('/auth/signup').send({
      firstName: 'testuser',
      lastName: 'testUserFamilyName',
      email: 'test@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(201);
    expect(verificationToken).toBeTruthy(); // Ensure we captured the token
  });

  it('should verify user', async () => {
    const res = await request(app).post('/auth/verify-email').send({
      token: verificationToken,
      email: 'test@test.com'
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Email verified successfully');
  });

  it('should not verify user with invalid token', async () => {
    const res = await request(app).post('/auth/verify-email').send({
      token: 'invalid-token',
      email: 'test@test.com'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('should not verify user with missing fields', async () => {
    const res = await request(app).post('/auth/verify-email').send({
      token: verificationToken
      // missing email
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid link');
  });

  it('should login user', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(200);
    token = res.body.token;
  });

  it('should not delete user: Missing Fields', async() => {
    const res = await request(app).post('/auth/deleteUser').send({
      email: "test@test.com"
    });
    expect(res.status).toBe(400);

    const res2 = await request(app).post('/auth/deleteUser').send({
      password: 'password123'
    });
    expect(res2.status).toBe(400);
  });

  it('should not delete user: Invalid email', async() => {
    const res = await request(app).post('/auth/deleteUser').send({
      email: 'invalidEmail',
      password: 'password123'
    });
    expect(res.status).toBe(400);
  })

  it('should not delete user: Incorrect password', async() => {
    const res = await request(app).post('/auth/deleteUser').send({
      email: 'test@test.com',
      password: 'incorrect'
    });
    expect(res.status).toBe(401);
  })

  it('should delete user', async() => {
    const res = await request(app).post('/auth/deleteUser').send({
      email: 'test@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(200);
  });

  it('should not delete user: User does not exist', async () => {
    const res = await request(app).post('/auth/deleteUser').send({
      email: 'test@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(404);
  });


});
