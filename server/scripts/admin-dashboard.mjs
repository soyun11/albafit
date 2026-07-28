#!/usr/bin/env node
// 관리자용 로컬 웹 대시보드 — CLI(admin.mjs)와 완전히 같은 로직(adminActions.mjs)을 화면으로 감싼 것.
// 배포 코드(src/index.js, api/index.js)와 별개의 진입점이라 프로덕션에 실릴 일이 없다.
// 127.0.0.1에만 바인딩해서 로컬 밖에서는 접근 자체가 안 된다 — 인증을 따로 안 두는 이유.
import 'dotenv/config'
import express from 'express'
import { listAccounts, createTestStore, resetPassword, previewDelete, deleteAccount } from './adminActions.mjs'

const PORT = Number(process.env.ADMIN_DASHBOARD_PORT) || 4100

const app = express()
app.use(express.urlencoded({ extended: true }))

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function layout(title, body) {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${title} · albafit 관리자</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 880px; margin: 40px auto; padding: 0 20px; color: #14171c; line-height: 1.5; }
  h1 { font-size: 20px; margin-bottom: 4px; } h2 { font-size: 15px; margin: 32px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 24px; font-size: 13px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { color: #6b7280; font-weight: 600; }
  form.inline { display: inline; margin: 0; }
  input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; margin: 2px 4px 2px 0; font-size: 13px; }
  button { padding: 6px 12px; border: none; border-radius: 4px; background: #3d6fe0; color: #fff; cursor: pointer; font-size: 13px; }
  button.danger { background: #c0392b; }
  button.ghost { background: #eee; color: #14171c; }
  a.danger-link { color: #c0392b; font-size: 12px; margin-left: 8px; }
  fieldset { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
  legend { padding: 0 6px; font-size: 13px; font-weight: 600; }
  .flash { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
  .flash.ok { background: #e6f4ea; color: #1d8c5a; }
  .flash.error { background: #fdecea; color: #c0392b; }
  .warn { color: #c0392b; font-size: 12px; margin-bottom: 20px; }
  .field-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
</style></head>
<body>
<h1>albafit 관리자 대시보드</h1>
<p class="warn">⚠️ 로컬 전용입니다 — server/.env의 DATABASE_URL(지금은 프로덕션 Supabase)에 직접 연결됩니다. 이 화면을 인터넷에 노출하지 마세요.</p>
${body}
</body></html>`
}

function flashHtml(query) {
  if (!query.flash) return ''
  const type = query.type === 'error' ? 'error' : 'ok'
  return `<div class="flash ${type}">${escapeHtml(query.flash)}</div>`
}

app.get('/', async (req, res) => {
  const { stores, orphanUsers } = await listAccounts()

  const rows = stores
    .map((s) => `
      <tr>
        <td>${escapeHtml(s.industry)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.owner ? `${escapeHtml(s.owner.email)}<a class="danger-link" href="/delete/confirm?email=${encodeURIComponent(s.owner.email)}">삭제</a>` : '-'}</td>
        <td>${s.staff.map((st) => `${escapeHtml(st.email)}<a class="danger-link" href="/delete/confirm?email=${encodeURIComponent(st.email)}">삭제</a>`).join('<br>') || '-'}</td>
      </tr>`)
    .join('')

  const orphanRows = orphanUsers
    .map((u) => `<li>${escapeHtml(u.role)}: ${escapeHtml(u.email)}<a class="danger-link" href="/delete/confirm?email=${encodeURIComponent(u.email)}">삭제</a></li>`)
    .join('')

  const body = `
    ${flashHtml(req.query)}
    <h2>매장 목록 (${stores.length})</h2>
    <table>
      <tr><th>업종</th><th>매장명</th><th>사장님</th><th>알바</th></tr>
      ${rows || '<tr><td colspan="4">매장이 없어요.</td></tr>'}
    </table>
    ${orphanUsers.length > 0 ? `<h2>매장 없는 계정 (${orphanUsers.length})</h2><ul>${orphanRows}</ul>` : ''}

    <fieldset>
      <legend>테스트 매장 만들기</legend>
      <form method="post" action="/create-test-store">
        <div class="field-row">
          <input name="ownerEmail" type="email" placeholder="사장님 이메일" required>
          <input name="ownerPassword" type="text" placeholder="사장님 비밀번호 (8자+)" required>
          <select name="industry">
            <option value="cafe">카페</option>
            <option value="convenience">편의점</option>
            <option value="restaurant">음식점</option>
            <option value="mart">마트</option>
            <option value="pcroom">PC방</option>
            <option value="beauty">뷰티</option>
          </select>
        </div>
        <div class="field-row">
          <input name="staffEmail" type="email" placeholder="알바 이메일 (선택)">
          <input name="staffPassword" type="text" placeholder="알바 비밀번호 (선택)">
        </div>
        <button type="submit">매장+계정 생성</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>비밀번호 재설정</legend>
      <form method="post" action="/reset-password">
        <div class="field-row">
          <input name="email" type="email" placeholder="이메일" required>
          <input name="password" type="text" placeholder="새 비밀번호 (8자+)" required>
          <button type="submit">재설정</button>
        </div>
      </form>
    </fieldset>
  `

  res.send(layout('대시보드', body))
})

app.post('/create-test-store', async (req, res) => {
  try {
    const result = await createTestStore(req.body)
    const flash = `사장님 ${result.owner.email} / 매장 ${result.store.name}${result.staff ? ` / 알바 ${result.staff.email}` : ''} 생성 완료`
    res.redirect(`/?flash=${encodeURIComponent(flash)}`)
  } catch (err) {
    res.redirect(`/?type=error&flash=${encodeURIComponent(err.message)}`)
  }
})

app.post('/reset-password', async (req, res) => {
  try {
    const user = await resetPassword(req.body)
    res.redirect(`/?flash=${encodeURIComponent(`${user.email} 비밀번호를 재설정했어요`)}`)
  } catch (err) {
    res.redirect(`/?type=error&flash=${encodeURIComponent(err.message)}`)
  }
})

// 삭제는 링크 한 번으로 안 끝나게, 서버가 렌더링하는 확인 화면을 한 번 거친다(되돌릴 수 없는 작업이라).
app.get('/delete/confirm', async (req, res) => {
  const email = req.query.email
  const preview = await previewDelete(email)
  if (!preview) {
    res.redirect(`/?type=error&flash=${encodeURIComponent('그 이메일의 계정이 없어요')}`)
    return
  }

  const { user, staffInStore } = preview
  const body = `
    <h2>정말 삭제할까요?</h2>
    <p><strong>${escapeHtml(user.role)}</strong>: ${escapeHtml(user.email)}</p>
    ${user.role === 'owner' && user.storeId ? `
      <p style="color:#c0392b">매장과 그 안의 규칙·시나리오·훈련 기록이 전부 같이 삭제됩니다.</p>
      ${staffInStore.length > 0 ? `<p>같이 삭제될 알바 계정: ${staffInStore.map((s) => escapeHtml(s.email)).join(', ')}</p>` : ''}
    ` : ''}
    <form method="post" action="/delete">
      <input type="hidden" name="email" value="${escapeHtml(email)}">
      <button type="submit" class="danger">삭제 확정</button>
      <a href="/"><button type="button" class="ghost">취소</button></a>
    </form>
  `
  res.send(layout('삭제 확인', body))
})

app.post('/delete', async (req, res) => {
  try {
    const preview = await deleteAccount(req.body.email)
    if (!preview) {
      res.redirect(`/?type=error&flash=${encodeURIComponent('그 이메일의 계정이 없어요')}`)
      return
    }
    const flash = `${preview.user.email} 계정${preview.user.role === 'owner' ? '과 매장 전체' : ''}를 삭제했어요`
    res.redirect(`/?flash=${encodeURIComponent(flash)}`)
  } catch (err) {
    res.redirect(`/?type=error&flash=${encodeURIComponent(err.message)}`)
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`관리자 대시보드: http://localhost:${PORT} (로컬 전용, Ctrl+C로 종료)`)
})
