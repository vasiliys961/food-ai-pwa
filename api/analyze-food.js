import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { imageBase64, userParams, reference } = req.body;

    // Тщательный промпт на русском:
    const prompt =
      `На фото — блюдо и референс (${reference === 'карта' ? 'банковская карта 85.6x54мм' : reference === 'ложка' ? 'ложка 150мм' : 'стакан 120мм высота, 75мм диаметр'}).
Определи:
- название блюда/продукта,
- примерный вес порции (граммы),
- основные ингредиенты,
- калорийность (ккал).
Ответь СТРОГО JSON как:
{"dish":"...", "weight_g":123, "ingredients":["..."], "calories":123} без лишних пояснений!`;

    // Ключ только из переменных окружения!
    const claudeKey = process.env.CLAUDE_API_KEY;

    if (!claudeKey) {
      return res.status(500).json({ error: 'CLAUDE_API_KEY не задан в окружении Vercel!' });
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
      images: [imageBase64]
    }, {
      headers: {
        'x-api-key': claudeKey,
        'content-type': 'application/json'
      }
    });

    const rawText = response.data.content[0]?.text || '{}';
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      const match = rawText.match(/\{[\s\S]*\}/);
      data = match ? JSON.parse(match[0]) : null;
    }

    if (!data || !data.dish) {
      return res.status(422).json({ error: 'AI не распознал блюдо. Ответ: ' + rawText });
    }
    return res.status(200).json({ ...data, userParams, reference });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
}
