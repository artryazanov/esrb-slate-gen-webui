/**
 * @jest-environment node
 */
import { proxy } from './proxy';
import { NextRequest } from 'next/server';

describe('Proxy Rate Limiting', () => {
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
            const res = await proxy(req);
            // Middleware returns NextResponse.next() which usually has status 200 (or serves as a pass-through)
            // Strictly speaking middleware that passes returns a response that indicates continuation.
            // In Next.js middleware, NextResponse.next() returns a response with specific internal headers or just a 200 ok for testing purposes.
            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('30');
            expect(res.headers.get('X-RateLimit-Remaining')).toBe((30 - (i + 1)).toString());
        }
    });

    it('should block requests over the limit', async () => {
        const ip = '2.2.2.2';
        // Exhaust limit
        for (let i = 0; i < 30; i++) {
            const req = createRequest(ip);
            await proxy(req);
        }

        // Next request should fail
        const req = createRequest(ip);
        const res = await proxy(req);
        expect(res.status).toBe(429);
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(res.headers.get('Retry-After')).toBeDefined();

        // Check for JSON error response
        const data = await res.json();
        expect(data).toEqual({ error: 'Too Many Requests' });
    });

    it('should ignore other paths', async () => {
        const req = new NextRequest(new URL('http://localhost/other-path'));
        const res = await proxy(req);
        // Should pass through without rate limit headers
        expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
        expect(res.status).toBe(200);
    });

    it('should respect custom rate limit from env', () => {
        jest.isolateModules(() => {
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';
            // Require fresh module to pick up env var
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { proxy: isolatedProxy } = require('./proxy');
            const ip = '3.3.3.3';

            // 5 requests allowed
            for (let i = 0; i < 5; i++) {
                const res = isolatedProxy(createRequest(ip));
                expect(res.status).toBe(200);
                expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
            }

            // 6th blocked
            const res = isolatedProxy(createRequest(ip));
            expect(res.status).toBe(429);
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(res.headers.get('Retry-After')).toBeDefined();

            // Check for JSON error response (mocking json() since we're in node environment with jest-environment-node)
            // Note: In real middleware test environment, .json() works. Here with node-mocks-http or similar it might differ 
            // but we are using next/server types. Let's see if we can just check body if needed, 
            // but NextResponse in test environment usually supports .json() if we wait for it.
            // Actually, isolatedMiddleware returns a NextResponse. 
            // Depending on how NextResponse is polyfilled in 'jest-environment-node', .json() might need await.
            // The previous test case used await middleware(req), but here we call isolatedMiddleware directly.
            // Let's add async/await to be safe and consistent with the other test.

            // We need to handle the promise if .json() returns one. 
            // However, since we can't easily await inside the synchronous isolateModules callback if the loop was synchronous?
            // Wait, isolateModules is synchronous. The test function is synchronous here?
            // "should respect custom rate limit from env" does not have async keyword.
            // Let's rely on checking the body if possible or just the status/headers as before?
            // The user request was specific about "Unexpected token 'T', "Too Many Requests" is not valid JSON".
            // So we really should verify it returns JSON.
            // Let's try to verify the content if possible. 
            // If checking body is hard in this specific sync test block, we can at least check Content-Type header.
            expect(res.headers.get('Content-Type')).toBe('application/json');
        });
    });
});
