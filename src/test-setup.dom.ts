// DOM test setup — imported before each DOM test suite via vitest.dom.config.ts
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
