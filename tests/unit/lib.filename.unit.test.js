import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename } from '../../lib/filename.js';

test('sanitizeFilename', async (t) => {
    await t.test('prefixes plain name with timestamp', () => {
        const result = sanitizeFilename('report.pdf');
        assert.match(result, /^\d+-report\.pdf$/);
    });

    await t.test('strips directory traversal', () => {
        const result = sanitizeFilename('../../../etc/passwd.pdf');
        assert.match(result, /^\d+-passwd\.pdf$/);
        assert.ok(!result.includes('/'));
    });

    await t.test('replaces spaces and unicode with underscore', () => {
        const result = sanitizeFilename('my résumé.pdf');
        assert.match(result, /^\d+-my_r_sum_\.pdf$/);
    });

    await t.test('preserves leading dot of extension', () => {
        const result = sanitizeFilename('.hidden');
        assert.match(result, /^\d+-\.hidden$/);
    });

    await t.test('handles empty string without throwing', () => {
        const result = sanitizeFilename('');
        assert.match(result, /^\d+-$/);
    });
});
