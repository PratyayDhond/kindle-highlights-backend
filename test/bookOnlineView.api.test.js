const request = require('supertest');
const { app } = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Book Online View API Endpoints', () => {
    describe('Delete Highlight', () => {
        it('should delete a highlight', async () => {
            const res = await request(app)
                .delete('/book/online/highlight/12345')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Highlight deleted successfully');
        });
    });
});