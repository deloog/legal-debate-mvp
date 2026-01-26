# Test Infrastructure

This directory contains all the testing utilities and configurations for the Legal Debate MVP project.

## 📁 Structure

```
src/test-utils/
├── index.ts              # Main export file
├── setup.ts              # Jest global setup
├── render.tsx            # Custom render with providers
├── database.ts           # Test database utilities
├── factories/            # Data factories for testing
│   └── index.ts
└── README.md             # This file
```

## 🧪 Testing Tools

### Jest (Unit & Integration Tests)

- **Configuration**: `jest.config.ts`
- **Environment**: jsdom with React Testing Library
- **Scripts**:
  - `npm run test` - Run all tests
  - `npm run test:watch` - Run tests in watch mode
  - `npm run test:coverage` - Generate coverage report

### Playwright (E2E Tests)

- **Configuration**: `playwright.config.ts`
- **Browsers**: Chromium, Firefox, WebKit, Mobile
- **Scripts**:
  - `npm run test:e2e` - Run E2E tests
  - `npm run test:e2e:ui` - Run E2E tests with UI
  - `npm run test:e2e:debug` - Debug E2E tests
  - `npm run test:e2e:codegen` - Generate tests with codegen

## 🏭 Test Factories

Use the factory functions to create mock data:

```typescript
import { createUser, createDocument, createAnalysis } from '@/test-utils';

const user = createUser({ email: 'custom@example.com' });
const document = createDocument({ title: 'Custom Document' });
const analysis = createAnalysis({ type: AnalysisType.LEGAL_STRUCTURE });
```

## 🎨 Custom Render

Use the custom render function for React components:

```typescript
import { render, screen } from '@/test-utils';

render(<MyComponent />);
expect(screen.getByText('Hello')).toBeInTheDocument();
```

## 🗄️ Test Database

Test database utilities are available but currently use local type definitions:

```typescript
import {
  setupTestDatabase,
  cleanupTestDatabase,
  testPrisma,
} from '@/test-utils';

// Setup before tests
beforeAll(async () => {
  await setupTestDatabase();
});

// Cleanup after tests
afterAll(async () => {
  await cleanupTestDatabase();
});
```

## 🛠️ Test Utilities

Additional helper functions:

```typescript
import {
  waitFor,
  createMockResponse,
  createMockErrorResponse,
  createMockLocalStorage,
} from '@/test-utils';

// Wait for async operations
await waitFor(1000);

// Create mock API responses
const mockResponse = createMockResponse({ data: 'success' });

// Mock browser storage
const mockStorage = createMockLocalStorage();
```

## 📊 Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- HTML Report: `coverage/lcov-report/index.html`
- LCOV Format: `coverage/lcov.info`
- Text Summary: Console output

Coverage thresholds are set to 70% for:

- Statements
- Branches
- Functions
- Lines

## 🔧 Environment Variables

Test environment variables are defined in `.env.test`:

```
NODE_ENV=test
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL_TEST="file:./test.db"
```

## 📝 Best Practices

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test multiple components working together
3. **E2E Tests**: Test complete user workflows
4. **Mocking**: Mock external dependencies (APIs, databases)
5. **Cleanup**: Always clean up after tests
6. **Coverage**: Maintain at least 70% code coverage

## 🚀 Running Tests

### All Tests

```bash
npm run test:all
```

### Unit Tests Only

```bash
npm run test
```

### E2E Tests Only

```bash
npm run test:e2e
```

### Coverage Report

```bash
npm run test:coverage
```

## 🐛 Debugging

### Jest Debugging

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Debugging

```bash
# Run with UI and debug mode
npm run test:e2e:debug
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
