// File: test/api.test.js

const request = require('supertest');
const express = require('express');
const app = require('../server');
const assert = require('assert');

describe('API Endpoints', function () {
  let token = '';

  it('Signup user', async () => {
    const res = await request(app).post('/signup').send({
      username: 'testuser',
      password: 'password123'
    });
    assert.strictEqual(res.status, 201);
  });

  it('Login user', async () => {
    const res = await request(app).post('/login').send({
      username: 'testuser',
      password: 'password123'
    });
    assert.strictEqual(res.status, 200);
    token = res.body.token;
  });

  it('Upload highlights', async () => {
    const res = await request(app)
      .post('/user-highlights')
      .set('Authorization', `Bearer ${token}`)
      .send({ highlights: ['Highlight 1', 'Highlight 2'] });
    assert.strictEqual(res.status, 200);
  });

  it('Download formatted highlights as zip', async () => {
    const res = await request(app)
      .get('/formatted-highlights')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 200);
    assert(res.headers['content-type'].includes('application/zip'));
  });
});
