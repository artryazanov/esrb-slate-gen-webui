/**
 * @jest-environment node
 */
import { middleware } from './middleware';
import { NextRequest } from 'next/server';

describe('Middleware Rate Limiting', () => {
    const SCRIPT_NAME = '/api/generate';

    const createRequest = (ip: string) => {
        const req = new NextRequest(new URL(`http://localhost${SCRIPT_NAME}`));
        // Headers are read-only in some environments, but NextRequest allows defining them in init
        // However, headers.set might be needed or mocking headers.
        // In NextRequest, we can pass headers in init.
        // But middleware reads 'x-forwarded-for'.
        Object.defineProperty(req, 'headers', {
            value: new Headers({
                'x-forwarded-for': ip
            })
        });
        return req;
    };

    it('should allow requests under the limit', async () => {
        const ip = '1.1.1.1';
        for (let i = 0; i < 5; i++) {
            const req = createRequest(ip);
            const res = await middleware(req);
            // Middleware returns NextResponse.next() which usually has status 200 (or serves as a pass-through)
            // Strictly speaking middleware that passes returns a response that indicates continuation.
            // In Next.js middleware, NextResponse.next() returns a response with specific internal headers or just a 200 ok for testing purposes.
            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
            expect(res.headers.get('X-RateLimit-Remaining')).toBe((10 - (i + 1)).toString());
        }
    });

    it('should block requests over the limit', async () => {
        const ip = '2.2.2.2';
        // Exhaust limit
        for (let i = 0; i < 10; i++) {
            const req = createRequest(ip);
            await middleware(req);
        }

        // Next request should fail
        const req = createRequest(ip);
        const res = await middleware(req);
        expect(res.status).toBe(429);
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(res.headers.get('Retry-After')).toBeDefined();
    });

    it('should ignore other paths', async () => {
        const req = new NextRequest(new URL('http://localhost/other-path'));
        const res = await middleware(req);
        // Should pass through without rate limit headers
        expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
        expect(res.status).toBe(200);
    });

    it('should respect custom rate limit from env', () => {
        jest.isolateModules(() => {
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';
            // Require fresh module to pick up env var
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { middleware: isolatedMiddleware } = require('./middleware');
            const ip = '3.3.3.3';

            // 5 requests allowed
            for (let i = 0; i < 5; i++) {
                const res = isolatedMiddleware(createRequest(ip));
                expect(res.status).toBe(200);
                expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
            }

            // 6th blocked
            const res = isolatedMiddleware(createRequest(ip));
            expect(res.status).toBe(429);
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(res.headers.get('Retry-After')).toBeDefined();
        });
    });
});
