import OpenAI from 'openai'

// 손님 에이전트용 클라이언트 — 대화 애드리브, 할루시네이션 위험 낮음
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default openai
