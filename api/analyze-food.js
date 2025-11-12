export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, userParams, reference } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Изображение не передано' });
    }

    const prompt = `На фото — блюдо и референс (${
      reference === 'карта' 
        ? 'банковская карта 85.6x54мм' 
        : reference === 'ложка' 
        ? 'ложка 150мм' 
        : 'стакан 120мм высота, 75мм диаметр'
    }).
Определи:
- название блюда/продукта,
- примерный вес порции (граммы),
- основные ингредиенты,
- калорийность (ккал).
Ответь СТРОГО JSON как:
{"dish":"...", "weight_g":123, "ingredients":["..."], "calories":123} без лишних пояснений!`;

    const claudeKey = process.env.CLAUDE_API_KEY;
    if (!claudeKey) {
      return res.status(500).json({ error: 'CLAUDE_API_KEY не задан в Vercel Environment!' });
    }

    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API error:', errorData);
      return res.status(response.status).json({ 
        error: `Claude API ошибка: ${response.status}`,
        debug: JSON.stringify(errorData)
      });
    }

    const apiData = await response.json();
    const rawText = apiData.content?.[0]?.text || '{}';

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      const match = rawText.match(/\{[\s\S]*\}/);
      data = match ? JSON.parse(match[0]) : null;
    }

    if (!data || !data.dish) {
      return res.status(422).json({ 
        error: 'AI не распознал блюдо. Попробуйте другое фото.',
        debug: rawText 
      });
    }

    return res.status(200).json({ 
      ...data, 
      userParams, 
      reference 
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ 
      error: 'Ошибка сервера: ' + err.message
    });
  }
}
