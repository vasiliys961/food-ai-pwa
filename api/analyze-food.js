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

 const prompt = `
    Твоя задача:
1. ТОЧНО определить название блюда/продукта/фрукта на РУССКОМ языке
2. Используя референс, определить примерный вес/размер порции в граммах
3. Перечислить основные ингредиенты на РУССКОМ языке
4. Определить реалистичную калорийность в ккал

Ответи ТОЛЬКО валидным JSON (без лишнего текста) в формате:
{
  "dish": "Точное название на русском",
  "weight_g": число,
  "ingredients": ["ингредиент 1", "ингредиент 2"],
  "calories": число
}

ВЫ ДОЛЖНЫ ОТВЕТИТЬ ТОЛЬКО JSON, НИЧЕГО БОЛЬШЕ!`

ВАЖНО: Ответ ДОЛЖЕН быть ТОЛЬКО JSON, никакого другого текста!`;


    const claudeKey = process.env.OPENROUTER_API_KEY
    if (!claudeKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY не задан в Vercel Environment!'});
       }
      const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
'Authorization': `Bearer ${claudeKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-5-sonnet',
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
const rawText = apiData.choices?.[0]?.message?.content || '{}';
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

 // Calculate TDEE (Total Daily Energy Expenditure) and daily recommendation
 const { weight, height, sex, activity, goal } = userParams;
 const activityMultiplier = { 'Малоподвижный': 1.2, 'Активный': 1.55, 'Очень активный': 1.9 }[activity] || 1.5;
 const sexCoeff = sex === 'Женский' ? -161 : 5;
 const tdee = Math.round((10 * weight + 6.25 * height - 5 * 30 + sexCoeff) * activityMultiplier);
 const goalAdjustment = { 'Снижение веса': -500, 'Поддержание': 0, 'Набор массы': 500 }[goal] || 0;
 const dailyNorm = tdee + goalAdjustment;
 const recommendation = data.calories <= dailyNorm ? '✅ В норме' : '⚠️ Много';
 data.dailyNorm = dailyNorm;
 data.recommendation = recommendation;

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
