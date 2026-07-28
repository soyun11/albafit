#!/usr/bin/env node
// 관리자용 로컬 CLI — 테스트 계정 만들기 / 비밀번호 재설정 / 계정(+매장) 삭제 / 계정 목록 조회.
// server/.env의 DATABASE_URL에 Prisma로 직접 붙는다 — 웹에 노출하지 않는다(docs/admin-cli.md).
// 실제 동작은 adminActions.mjs(admin-dashboard.mjs와 공유)에 있다 — 여기는 인자 파싱과 출력만.
import 'dotenv/config'
import prisma from '../src/lib/prisma.js'
import { listAccounts, createTestStore, resetPassword, previewDelete, deleteAccount } from './adminActions.mjs'

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) continue
    const key = rest[i].slice(2)
    const next = rest[i + 1]
    // --yes처럼 값 없이 켜고 끄는 플래그 — 다음 토큰이 없거나 또 다른 --옵션이면 값 없는 걸로 본다.
    if (next === undefined || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      i++
    }
  }
  return { command, options }
}

async function runList() {
  const { stores, orphanUsers } = await listAccounts()
  for (const store of stores) {
    console.log(`\n[${store.industry}] ${store.name ?? '(이름 없음)'} — ${store.id}`)
    console.log(`  사장님: ${store.owner?.email ?? '(없음)'}`)
    for (const staff of store.staff) console.log(`  알바: ${staff.email}`)
  }
  if (orphanUsers.length > 0) {
    console.log(`\n매장 없는 계정 (${orphanUsers.length}명):`)
    for (const user of orphanUsers) console.log(`  ${user.role}: ${user.email}`)
  }
}

async function runCreateTestStore(options) {
  const result = await createTestStore({
    ownerEmail: options['owner-email'],
    ownerPassword: options['owner-password'],
    industry: options.industry,
    storeName: options['store-name'],
    ownerName: options['owner-name'],
    staffEmail: options['staff-email'],
    staffPassword: options['staff-password'],
    staffName: options['staff-name'],
  })
  console.log(`사장님 계정: ${result.owner.email}`)
  console.log(`매장: ${result.store.name} (${result.store.id}, industry=${result.store.industry})`)
  if (result.staff) console.log(`알바 계정: ${result.staff.email}`)
}

async function runResetPassword(options) {
  const user = await resetPassword({ email: options.email, password: options.password })
  console.log(`${user.email}(${user.role}) 비밀번호를 재설정했어요.`)
}

async function runDeleteAccount(options) {
  if (!options.email) throw new Error('--email은 필수예요')

  const preview = await previewDelete(options.email)
  if (!preview) {
    console.log('그 이메일의 계정이 없어요.')
    return
  }

  if (!options.yes) {
    console.log(`--yes 없이는 실제로 지우지 않아요. 지워질 대상:`)
    console.log(`  ${preview.user.role}: ${preview.user.email}`)
    if (preview.user.role === 'owner' && preview.user.storeId) {
      console.log(`  매장(${preview.user.storeId})과 그 안의 규칙·시나리오·훈련 기록 전부`)
      for (const staff of preview.staffInStore) console.log(`  알바 계정: ${staff.email}`)
    }
    console.log(`다시 --yes를 붙여서 실행하세요.`)
    return
  }

  await deleteAccount(options.email)
  console.log(`${preview.user.email} 계정${preview.user.role === 'owner' ? '과 매장 전체' : ''}를 삭제했어요.`)
}

const COMMANDS = {
  list: runList,
  'create-test-store': runCreateTestStore,
  'reset-password': runResetPassword,
  'delete-account': runDeleteAccount,
}

function printUsage() {
  console.log(`사용법: node scripts/admin.mjs <command> [--옵션 값 ...]

명령:
  list                                              매장별 사장님·알바 이메일 목록
  create-test-store --owner-email --owner-password  테스트 사장님+매장(+선택: --staff-email --staff-password) 생성
                     [--industry] [--store-name] [--owner-name] [--staff-name]
  reset-password     --email --password             그 계정 비밀번호를 새 값으로 덮어쓴다(현재 비밀번호 불필요)
  delete-account      --email [--yes]                계정(사장님이면 매장 전체) 삭제. --yes 없으면 미리보기만

로컬 웹 화면으로 쓰려면: node scripts/admin-dashboard.mjs
자세한 설계 배경은 docs/admin-cli.md 참고.`)
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2))
  const handler = COMMANDS[command]
  if (!handler) {
    printUsage()
    process.exitCode = command ? 1 : 0
    return
  }

  try {
    await handler(options)
  } catch (err) {
    console.error(`오류: ${err.message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
