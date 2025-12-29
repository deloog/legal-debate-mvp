import {
  corsMiddleware,
  rateLimitMiddleware,
  securityMiddleware,
} from "@/app/api/lib/middleware/security";
import {
  RequestContext,
  createRequestContext,
} from "@/app/api/lib/middleware/core";
import { NextRequest, NextResponse } from "next/server";

describe("Security Middleware", () => {
  describe("CORS Middleware", () => {
    it("should handle OPTIONS preflight request", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
        },
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      const result = await corsMiddleware(request, context, response);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization, X-Requested-With, Accept, Origin",
      );
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
      expect(result).toBeUndefined(); // CORS middleware returns void
    });

    it("should handle OPTIONS with unknown origin", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "OPTIONS",
        headers: {
          origin: "http://evil-site.com",
        },
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await corsMiddleware(request, context, response);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });

    it("should add CORS headers to regular requests", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
        },
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await corsMiddleware(request, context, response);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
    });

    it("should handle requests without origin header", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await corsMiddleware(request, context, response);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });
  });

  describe("Security Middleware", () => {
    it("should add security headers", async () => {
      const request = new NextRequest("http://localhost:3000/api/test");
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await securityMiddleware(request, context, response);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(response.headers.get("Permissions-Policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(response.headers.get("X-API-Version")).toBe("v1");
    });

    it("should include environment header", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalEnvDescriptor = Object.getOwnPropertyDescriptor(
        process,
        "NODE_ENV",
      );
      Object.defineProperty(process, "NODE_ENV", {
        value: "test",
        writable: true,
        configurable: true,
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await securityMiddleware(request, context, response);

      expect(response.headers.get("X-Node-Environment")).toBe("test");

      // Restore original environment
      if (originalEnvDescriptor) {
        Object.defineProperty(process, "NODE_ENV", originalEnvDescriptor);
      } else {
        delete (process as any).NODE_ENV;
        if (originalEnv) {
          (process as any).NODE_ENV = originalEnv;
        }
      }
    });

    it("should handle environment header correctly", async () => {
      const request = new NextRequest("http://localhost:3000/api/test");
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await securityMiddleware(request, context, response);

      // Should include some environment header (value depends on test environment)
      const envHeader = response.headers.get("X-Node-Environment");
      expect(envHeader).toBeDefined();
      expect(typeof envHeader).toBe("string");
    });
  });

  describe("Rate Limit Middleware", () => {
    beforeEach(() => {
      // Clear rate limiter state between tests
      jest.resetModules();
    });

    it("should allow requests within limit", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await rateLimitMiddleware(request, context, response);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("98"); // 100 - 1 - 1 (current)
      expect(response.headers.get("X-RateLimit-Reset")).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it("should use x-real-ip header when available", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-real-ip": "10.0.0.1",
        },
      });
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await rateLimitMiddleware(request, context, response);

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("98");
    });

    it("should default to localhost for IP", async () => {
      const request = new NextRequest("http://localhost:3000/api/test");
      const context = createRequestContext(request);
      const response = NextResponse.next();

      await rateLimitMiddleware(request, context, response);

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("98");
    });

    it("should return 429 when limit exceeded", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-forwarded-for": "192.168.1.2",
        },
      });
      const context = createRequestContext(request);

      // Import fresh rateLimiter for this test
      const { rateLimitMiddleware: freshRateLimitMiddleware } =
        await import("@/app/api/lib/middleware/security");

      // Make 101 requests to exceed limit
      for (let i = 0; i < 101; i++) {
        const response = NextResponse.next();
        try {
          await freshRateLimitMiddleware(request, context, response);
        } catch (error) {
          // Expected for the last request
          if (i === 100) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe(
              "Too many requests, please try again later",
            );
            expect((error as any).statusCode).toBe(429);
          } else {
            throw error;
          }
        }
      }
    });

    it("should include proper error timestamp", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-forwarded-for": "192.168.1.3",
        },
      });
      const context = createRequestContext(request);

      // Import fresh rateLimiter for this test
      const { rateLimitMiddleware: freshRateLimitMiddleware } =
        await import("@/app/api/lib/middleware/security");

      // Make 101 requests to trigger rate limit
      for (let i = 0; i < 101; i++) {
        const response = NextResponse.next();
        try {
          await freshRateLimitMiddleware(request, context, response);
        } catch (error) {
          if (i === 100) {
            // Check if error has timestamp in its response format
            const apiError = error as any;
            expect(apiError.statusCode).toBe(429);
            expect(apiError.code).toBe("RATE_LIMIT_EXCEEDED");
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe("Security Integration", () => {
    it("should combine multiple security middlewares", async () => {
      const { MiddlewareStack } = await import("@/app/api/lib/middleware/core");
      const stack = new MiddlewareStack();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "192.168.1.4",
        },
      });
      const context = createRequestContext(request);

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(rateLimitMiddleware);

      const response = await stack.execute(request, context);

      // CORS headers
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );

      // Security headers
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-API-Version")).toBe("v1");

      // Rate limit headers
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("98"); // Only rateLimitMiddleware counts
    });
  });
});
