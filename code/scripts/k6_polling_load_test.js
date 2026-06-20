import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },  // Ramp-up to 50 concurrent users
    { duration: '20s', target: 50 }, // Maintain 50 concurrent users
    { duration: '5s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete within 200ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8001/api/v1';

export default function () {
  // Simulate polling the lightweight session status endpoint
  // We use a mock session handle for polling
  const mockSessionId = '6f7ab188-c54b-4085-a500-6c72659eb009';
  const url = `${BASE_URL}/kyc/session/status`;

  // Define headers (simulate authenticated client with device fingerprinting)
  const params = {
    headers: {
      'Accept': 'application/json',
      'X-Correlation-ID': `k6-test-${__VU}-${__ITER}`,
      // In a real environment, Authorization token and X-Device-Tag would be sent
      'Authorization': 'Bearer mock-token',
      'X-Device-Tag': 'mock-device-tag',
    },
  };

  const response = http.get(url, params);

  // Validate response status (since authorization may be required or session not found,
  // we check that the server returns either 200, 401, or 404, but NOT a 500/502/504 error).
  check(response, {
    'is not 5xx': (r) => r.status < 500,
    'response time ok': (r) => r.timings.duration < 500,
  });

  // Poll every 1-2 seconds with slight jitter
  sleep(1 + Math.random());
}
