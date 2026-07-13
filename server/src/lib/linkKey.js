import { randomBytes } from 'node:crypto'

export function generateLinkKey() {
  return randomBytes(16).toString('base64url')
}
