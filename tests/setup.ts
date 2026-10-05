import { afterEach } from 'vitest';
import { closeDatabases } from './helpers';

afterEach(() => closeDatabases());
