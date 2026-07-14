import { GoogleGenAI } from '@google/genai'

// 평가·루브릭 변환 에이전트용 클라이언트 — 출력 JSON 스키마 강제가 필요한 쪽
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export default gemini
