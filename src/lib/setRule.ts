import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SetRule } from './analytics';

const KEY = '@liftbook_set_rule';

/**
 * Which set represents a session in the statistics.
 *
 * Defaults to the first set: it is the only one performed under the same
 * conditions every time, so sessions stay comparable. Everything after it
 * depends on how hard the previous set was and how long the rest lasted.
 */
export const DEFAULT_SET_RULE: SetRule = 'first';

export async function loadSetRule(): Promise<SetRule> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return stored === 'best' || stored === 'first' ? stored : DEFAULT_SET_RULE;
  } catch {
    return DEFAULT_SET_RULE;
  }
}

export async function saveSetRule(rule: SetRule): Promise<void> {
  await AsyncStorage.setItem(KEY, rule);
}
