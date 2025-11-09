// api/analyze-food.js — CommonJS версия для Vercel + бесплатный Claude
const axios = require('axios');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-sonnet-20240229'; // ✅ Работает на бесплатном плане

async function searchOpenFoodFacts(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedQuery}&json=1&page_size=1`
    );
    const products = response.data.products;
    if (products && products.length > 0) {
      const p = products[0];
      return {
        dish: p.product_name || query,
        calories: p.nutriments?.energy_kcal ?? null,
        nutrients: {
          белки: Math.round(p.nutriments?.proteins ?? 0),
          жиры: Math.round(p.nutriments?.fat ?? 0),
          углеводы: Math.round(p.nutriments?.carbohydrates ?? 0)
        }
      };
    }
  } catch (e) {
    console.warn('OpenFoodFacts error:', e.message);
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const { imageBase64, userParams } = req.body;
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const prompt = `
Проанализируй это фото еды. В кадре банковская карта (85.6×53.98 мм).
Определи: название блюда, вес в граммах, основные ингредиенты.
Верни ТОЛЬКО JSON: {"dish":"...","weight_g":число,"ingredients":["..."]}.
Никаких пояснений.
  `.trim();

  try {
    const claudeRes = await axios.post(
      CLAUDE_API_URL,
      {
        model: MODEL,
        max_tokens: 600, // уменьшили для бесплатного плана
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 10000 // 10 сек — максимум для Hobby
      }
    );

    let text = claudeRes.data.content[0]?.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      data = match ? JSON.parse(match[0]) : null;
    }

    if (!data || !data.dish) throw new Error('Не распознано');

    const weight = data.weight_g || 200;
    const ofData = await searchOpenFoodFacts(data.dish);

    let calories = Math.round((150 / 100) * weight);
    let nutrients = { белки: 0, жиры: 0, углеводы: 0 };

    if (ofData?.calories) {
      calories = Math.round((ofData.calories / 100) * weight);
      nutrients = {
        белки: Math.round((ofData.nutrients.белки / 100) * weight),
        жиры: Math.round((ofData.nutrients.жиры / 100) * weight),
        углеводы: Math.round((ofData.nutrients.углеводы / 100) * weight)
      };
    }

    res.status(200).json({
      dish: data.dish,
      weight_g: weight,
      calories,
      nutrients,
      ingredients: data.ingredients || [],
      source: ofData ? 'OpenFoodFacts' : 'AI'
    });
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'Не удалось проанализировать фото. Попробуйте другое изображение.' });
  }
};
