// PostToolUse hook: format the file Claude just edited with Prettier.
// Always exits 0 so a formatting problem never blocks an edit.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { relative, resolve, isAbsolute } from 'node:path'

let input = ''
for await (const chunk of process.stdin) input += chunk

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const filePath = JSON.parse(input).tool_input?.file_path
  if (filePath) {
    const file = resolve(root, filePath)
    const rel = relative(root, file)
    const inRepo = rel && !rel.startsWith('..') && !isAbsolute(rel)
    if (inRepo && existsSync(file)) {
      execFileSync('npx', ['prettier', '--write', '--ignore-unknown', file], {
        cwd: root,
        stdio: 'ignore',
      })
    }
  }
} catch {
  // Ignore: formatting is best-effort.
}
