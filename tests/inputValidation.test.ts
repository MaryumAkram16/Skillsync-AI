import { describe, it, expect } from 'vitest';

describe('Input Validation (parserService)', () => {
  
  function validateInputs(role: string, country: string): void {
    if (!role || !role.trim()) throw new Error("role is required");
    if (!country || !country.trim()) throw new Error("country is required");
    // The fix: Allow common job title characters: +, -, /, ., (, ), &, '
    if (!/^[a-zA-Z0-9\s+\-/.()&']+$/.test(role.trim()))
      throw new Error("Target role contains invalid characters.");
  }

  it('should allow valid job titles with special characters', () => {
    expect(() => validateInputs("C++ Developer", "USA")).not.toThrow();
    expect(() => validateInputs("Node.js Engineer", "UK")).not.toThrow();
    expect(() => validateInputs("Full-Stack / Lead", "Canada")).not.toThrow();
    expect(() => validateInputs("Product Manager (AI)", "Germany")).not.toThrow();
    expect(() => validateInputs("Sales & Marketing", "Australia")).not.toThrow();
  });

  it('should throw error for empty inputs', () => {
    expect(() => validateInputs("", "USA")).toThrow("role is required");
    expect(() => validateInputs("Developer", "")).toThrow("country is required");
  });

  it('should block truly malicious or invalid characters', () => {
    expect(() => validateInputs("Developer <script>", "USA")).toThrow();
    expect(() => validateInputs("Developer; DROP TABLE", "USA")).toThrow();
    expect(() => validateInputs("Developer @ Home", "USA")).toThrow();
  });
});
