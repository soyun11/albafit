import { Resend } from 'resend'

// 도메인 인증 없이 바로 쓸 수 있는 Resend 기본 발신 주소. 실제 서비스로 나갈 땐 매장 도메인으로 바꿔야 한다.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'albafit <onboarding@resend.dev>'

// Resend SDK는 키가 없으면 생성자에서 바로 예외를 던진다 — 모듈 로드 시점에 만들어버리면 키를 아직
// 안 넣은 로컬 환경에서 서버 자체가 못 뜬다. 그래서 실제로 메일을 보낼 때만 만든다.
function getClient() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendVerificationEmail({ to, verifyUrl }) {
  const resend = getClient()
  if (!resend) {
    console.warn('RESEND_API_KEY가 없어서 인증 메일을 건너뜁니다:', verifyUrl)
    return
  }

  // Resend SDK는 실패해도 예외를 던지지 않고 {data, error} 형태로만 돌려준다 — error를 직접
  // 확인해서 던져야 호출부(auth.js)의 try/catch가 실패를 실패로 인식한다.
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: '[albafit] 이메일 인증을 완료해주세요',
    html: `
      <p>albafit 회원가입을 완료하려면 아래 링크를 눌러주세요. 30분 안에 눌러야 해요.</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
    `,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
