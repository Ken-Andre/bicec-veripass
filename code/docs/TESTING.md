# Testing Strategy - bicec-veripass

This document outlines the testing strategy and types of tests used in the bicec-veripass project.

## Test Types

### 1. Backend Unit Tests (pytest)
- **Location**: `code/backend/tests/`
- **Framework**: pytest with pytest-asyncio
- **Run command**: `cd code/backend ; python -m pytest tests/ -v`
- **Coverage**: API endpoints, health checks, OpenAPI documentation

### 2. Mobile Unit Tests (vitest)
- **Location**: `code/mobile/`
- **Framework**: Vitest
- **Run command**: `cd code/mobile ; bun run test`

### 3. Backoffice Unit Tests (vitest)
- **Location**: `code/backoffice/`
- **Framework**: Vitest
- **Run command**: `cd code/backoffice ; bun run test`

### 4. Mobile E2E Tests (Playwright)
- **Location**: `code/mobile/`
- **Framework**: Playwright
- **Run command**: `cd code/mobile ; bun run test:e2e`

### 5. Backoffice E2E Tests (Playwright)
- **Location**: `code/backoffice/`
- **Framework**: Playwright
- **Run command**: `cd code/backoffice ; bun run test:e2e`

### 6. Human/Manual Tests
- **Backend**: Manual API testing via Swagger UI or Postman
- **Mobile**: Manual testing on device/emulator
- **Backoffice**: Manual testing in browser

### 7. ML/Data Quality Tests (Future)
- **Location**: `paddleocr_test/`
- **Purpose**: OCR quality validation, data processing tests
- **Status**: Planned for future implementation

## Running All Tests

### Backend
```bash
cd code/backend
python -m pytest tests/ -v
```

### Mobile
```bash
cd code/mobile
bun run test        # Unit tests
bun run test:e2e    # E2E tests
```

### Backoffice
```bash
cd code/backoffice
bun run test        # Unit tests
bun run test:e2e    # E2E tests
```

## CI/CD Integration
Tests should be run automatically on:
- Pull request creation
- Before merging to develop
- Before merging to main

## Notes
- Always run backend tests before creating a PR
- E2E tests require the application to be running
- Human tests are essential for UX validation