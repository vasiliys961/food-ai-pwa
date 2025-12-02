// api/analyze-food.js — ES модуль для Vercel + OpenRouter (Claude Sonnet)
import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3.5-sonnet';

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

export default async function handler(req, res) {
  console.log('=== Handler started ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Устанавливаем таймаут для ответа
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('Request timeout');
      res.status(504).json({ error: 'Таймаут запроса' });
    }
  }, 28000); // 28 секунд (меньше чем 30 сек лимит Vercel)

  try {
    console.log('Inside try block');
    
    // Убеждаемся что это POST запрос
    if (req.method !== 'POST') {
      clearTimeout(timeout);
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: 'Метод не разрешён' });
    }

    console.log('Request received, method:', req.method);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', req.body ? Object.keys(req.body) : 'no body');

    // Парсим body если это строка
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        clearTimeout(timeout);
        console.error('JSON parse error:', e.message);
        return res.status(400).json({ error: 'Неверный формат JSON в теле запроса' });
      }
    }

    const { imageBase64, userParams, referenceType, referenceSize } = body || {};
    
    if (!imageBase64) {
      clearTimeout(timeout);
      console.error('No imageBase64 provided');
      return res.status(400).json({ error: 'Не передано изображение' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      clearTimeout(timeout);
      console.error('OPENROUTER_API_KEY не установлен');
      return res.status(500).json({ error: 'OPENROUTER_API_KEY не задан на сервере' });
    }

    console.log('API key found, image length:', imageBase64?.length || 0);
    console.log('Image starts with:', imageBase64?.substring(0, 50) || 'empty');

    // Подготовка изображения для OpenRouter
    let imageUrl = imageBase64;
    if (typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('data:image')) {
        // Уже правильный формат data URI
        imageUrl = imageBase64;
        console.log('Using data URI format, type:', imageBase64.substring(5, imageBase64.indexOf(';')));
      } else {
        // Если base64 без префикса, добавляем
        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        // Определяем тип изображения по первым байтам или используем jpeg по умолчанию
        imageUrl = `data:image/jpeg;base64,${base64Data}`;
        console.log('Added data URI prefix, base64 length:', base64Data.length);
      }
      
      // Проверяем что imageUrl валидный
      if (!imageUrl.startsWith('data:image')) {
        clearTimeout(timeout);
        console.error('Invalid image format after processing');
        return res.status(400).json({ error: 'Неверный формат изображения' });
      }
    } else {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Неверный формат изображения' });
    }
    
    console.log('Final imageUrl length:', imageUrl.length, 'starts with:', imageUrl.substring(0, 30));

    // Референсная информация
    const referenceInfo = {
      card: { name: 'банковская карта', size: '85.6×53.98 мм', description: '85.6 мм в длину и 53.98 мм в ширину' },
      spoon: { name: 'столовая ложка', size: '200 мм', description: 'длиной 200 мм (20 см)' },
      glass: { name: 'стакан', size: '~70 мм диаметр, ~100 мм высота', description: 'диаметром примерно 70 мм и высотой 100 мм' }
    };

    const refType = referenceType || 'card';
    const ref = referenceInfo[refType] || referenceInfo.card;
    const refSize = referenceSize || (refType === 'spoon' ? 200 : refType === 'glass' ? 70 : 85.6);

    const systemPrompt = `Ты профессиональный диетолог и эксперт по распознаванию блюд с 20-летним опытом.

ТВОЯ ЗАДАЧА:
1. ВНИМАТЕЛЬНО проанализировать фото блюда
2. Точно определить название блюда (учитывай русскую кухню: борщ, пельмени, гречка, плов, салат оливье и т.д.)
3. Оценить вес блюда в граммах с учетом референсного объекта (${ref.name}, ${ref.size})
4. Определить основные ингредиенты

ИНСТРУКЦИИ ПО АНАЛИЗУ:
- Внимательно рассмотри все детали фото: цвет, текстуру, форму, размер порции
- Определи основные ингредиенты (мясо, овощи, крупы, соусы, масло)
- Оцени объем порции, сравнивая с референсным объектом (${ref.name})
- Учти способ приготовления (жареное, вареное, тушеное)

ОЦЕНКА ВЕСА:
- На фото есть ${ref.name} (${ref.description}) - используй её для точной оценки
- Сравни размер блюда с референсом
- Учитывай плотность продукта (жидкое/твердое)
- Для порций на тарелке оценивай объем, а не только площадь
- ${refType === 'spoon' ? 'Ложка помогает оценить глубину и объем жидких/полужидких блюд.' : ''}
- ${refType === 'glass' ? 'Стакан помогает оценить объем напитков и жидких блюд.' : ''}

ФОРМАТ ОТВЕТА (строго JSON, без markdown, без комментариев):
{
  "dish": "точное название на русском",
  "weight_g": точное_число_в_граммах,
  "ingredients": ["ингредиент1", "ингредиент2", ...]
}

ВАЖНО: Верни ТОЛЬКО валидный JSON, без дополнительного текста, без markdown разметки.`;

    const userPrompt = `ВНИМАТЕЛЬНО проанализируй это фото еды.

РЕФЕРЕНС: На фото есть ${ref.name} (${ref.description}). Используй её для точной оценки размера и веса блюда. Сравни размер порции с этим объектом.

ШАГИ АНАЛИЗА:
1. Детально рассмотри фото - что именно изображено? (блюдо, ингредиенты, способ приготовления)
2. Определи точное название блюда на русском языке
3. Оцени вес порции в граммах (используй ${ref.name} для масштаба)
4. Перечисли основные ингредиенты

Верни результат в формате JSON как указано в инструкциях.`;

    console.log('Sending request to OpenRouter...');
    const requestPayload = {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            },
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ]
    };
    
    console.log('Request payload prepared, image_url length:', imageUrl.length);
    
    const openRouterRes = await axios.post(
      OPENROUTER_API_URL,
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://food-ai-pwa.vercel.app',
          'X-Title': 'Food AI PWA'
        },
        timeout: 30000
      }
    );

    console.log('OpenRouter response status:', openRouterRes.status);
    console.log('OpenRouter response data keys:', Object.keys(openRouterRes.data || {}));
    console.log('Choices count:', openRouterRes.data?.choices?.length || 0);
    
    if (!openRouterRes.data?.choices || openRouterRes.data.choices.length === 0) {
      clearTimeout(timeout);
      console.error('No choices in OpenRouter response:', JSON.stringify(openRouterRes.data, null, 2));
      return res.status(500).json({ 
        error: 'AI не вернул ответ. Попробуйте другое фото.',
        details: 'Пустой ответ от OpenRouter'
      });
    }

    let text = openRouterRes.data.choices?.[0]?.message?.content || '{}';
    console.log('Response text length:', text.length, 'first 200 chars:', text.substring(0, 200));
    
    // Извлекаем JSON из ответа (может быть обернут в markdown)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      // Пытаемся найти JSON в тексте
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error('Не удалось распарсить JSON из ответа');
      }
    }

    if (!data || !data.dish) {
      throw new Error('Не распознано блюдо в ответе');
    }

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
    } else {
      // Если нет данных в OpenFoodFacts, используем приблизительные значения на основе типа блюда
      const dishLower = data.dish.toLowerCase();
      let baseCalories = 150; // среднее значение
      
      if (dishLower.includes('салат') || dishLower.includes('овощ')) {
        baseCalories = 50;
        nutrients = { белки: 2, жиры: 0, углеводы: 10 };
      } else if (dishLower.includes('мясо') || dishLower.includes('куриц') || dishLower.includes('говядин')) {
        baseCalories = 200;
        nutrients = { белки: 20, жиры: 12, углеводы: 0 };
      } else if (dishLower.includes('рыб')) {
        baseCalories = 120;
        nutrients = { белки: 18, жиры: 5, углеводы: 0 };
      } else if (dishLower.includes('макарон') || dishLower.includes('паста') || dishLower.includes('спагетти')) {
        baseCalories = 130;
        nutrients = { белки: 5, жиры: 1, углеводы: 25 };
      } else if (dishLower.includes('рис') || dishLower.includes('гречк') || dishLower.includes('каш')) {
        baseCalories = 120;
        nutrients = { белки: 4, жиры: 1, углеводы: 22 };
      } else if (dishLower.includes('суп') || dishLower.includes('борщ')) {
        baseCalories = 60;
        nutrients = { белки: 3, жиры: 2, углеводы: 8 };
      }
      
      calories = Math.round((baseCalories / 100) * weight);
      nutrients = {
        белки: Math.round((nutrients.белки / 100) * weight),
        жиры: Math.round((nutrients.жиры / 100) * weight),
        углеводы: Math.round((nutrients.углеводы / 100) * weight)
      };
    }

    clearTimeout(timeout);
    res.status(200).json({
      dish: data.dish,
      weight_g: weight,
      calories,
      nutrients,
      ingredients: data.ingredients || [],
      source: ofData ? 'OpenFoodFacts' : 'AI'
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('=== ERROR CAUGHT ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }
    
    // Убеждаемся что ответ еще не отправлен
    if (!res.headersSent) {
      const errorMessage = error.message || 'Неизвестная ошибка';
      console.error('Sending error response:', errorMessage);
      res.status(500).json({ 
        error: 'Не удалось проанализировать фото. Попробуйте другое изображение.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    } else {
      console.error('Response already sent, cannot send error');
    }
  }
}
