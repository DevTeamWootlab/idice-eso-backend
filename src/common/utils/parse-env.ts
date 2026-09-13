import { OperatingState } from '../enums/application.enum';

export function toInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

const VALID_OPERATING_STATES = new Set(Object.values(OperatingState));

/**
 * Safely parses and converts raw input string to an OperatingState enum value
 */
export function toOperatingState(rawInput?: string): OperatingState | null {
  if (!rawInput) return null;
  const normalized = normalizeText(rawInput).trim().toUpperCase();
  return VALID_OPERATING_STATES.has(normalized as OperatingState)
    ? (normalized as OperatingState)
    : null;
}
