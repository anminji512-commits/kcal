export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Restrict to POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다. Vercel Settings > Environment Variables 메뉴에서 추가해 주세요.'
    });
  }

  try {
    const { contents, generationConfig, systemInstruction, model } = req.body || {};

    if (!contents) {
      return res.status(400).json({ error: '요청 본문에 contents 항목이 누락되었습니다.' });
    }

    // 표준 Gemini 1.5 Flash 모델 엔드포인트 사용
    const selectedModel = model || 'gemini-3.1-flash-lite';
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const payload = {
      contents,
      ...(generationConfig && { generationConfig }),
      ...(systemInstruction && { systemInstruction })
    };

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // 만약 해당 모델을 찾을 수 없는 경우 (404) gemini-2.0-flash로 재시도
   if (response.status === 404) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Gemini API 오류 (상태 코드: ${response.status})`
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Gemini Serverless Function Error:', error);
    return res.status(500).json({
      error: error.message || '서버 내부 처리 오류가 발생했습니다.'
    });
  }
}