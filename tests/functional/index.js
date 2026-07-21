import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
    path.join(__dirname, 'server.api.test.js'),
    path.join(__dirname, 'server.security.test.js'),
];

let exitCode = 0;
for (const file of files) {
    const result = spawnSync(
        process.execPath,
        [file],
        {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'inherit',
        }
    );
    if (result.status !== 0) {
        exitCode = result.status || 1;
    }
}

process.exit(exitCode);
