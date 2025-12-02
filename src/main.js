let imageBase64 = null;

// Референсные размеры
const REFERENCE_SIZES = {
  card: { name: 'Банковская карта', size: '85.6×53.98 мм' },
  spoon: { name: 'Столовая ложка', size: '200 мм (длина)' },
  glass: { name: 'Стакан', size: 'диаметр ~70 мм, высота ~100 мм' }
};

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imageBase64 = reader.result;
    document.getElementById('preview').innerHTML = `<img src="${imageBase64}" alt="Фото блюда" />`;
    document.getElementById('analyzeBtn').disabled = false;
    document.getElementById('analyzeBtn').textContent = 'Анализировать';
  };
  reader.readAsDataURL(file);
});

// Расчет дневной нормы калорий (BMR + TDEE)
function calculateDailyCalories(weight, height, sex, goal, activity) {
  // BMR (базальный метаболизм) по формуле Миффлина-Сан Жеора
  let bmr;
  if (sex === 'муж') {
    bmr = 10 * weight + 6.25 * height - 5 * 30 + 5; // возраст ~30
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * 30 - 161;
  }

  // TDEE (общий расход энергии) с учетом активности
  let tdee;
  if (activity === 'активный') {
    tdee = bmr * 1.725; // Высокая активность
  } else {
    tdee = bmr * 1.375; // Умеренная активность
  }

  // Корректировка по цели
  if (goal === 'снижение') {
    tdee = tdee * 0.85; // Дефицит 15%
  } else if (goal === 'набор') {
    tdee = tdee * 1.15; // Профицит 15%
  }
  // Поддержание - без изменений

  return Math.round(tdee);
}

// Получить калории за сегодня
function getTodayCalories() {
  const today = new Date().toDateString();
  const dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
  return dayLog
    .filter(item => new Date(item.timestamp).toDateString() === today)
    .reduce((sum, item) => sum + (item.calories || 0), 0);
}

// Обновить статистику за день
function updateDailyStats() {
  const weight = +document.getElementById('weight').value;
  const height = +document.getElementById('height').value;
  const sex = document.getElementById('sex').value;
  const goal = document.getElementById('goal').value;
  const activity = document.getElementById('activity').value;

  if (!weight || !height) return;

  const dailyLimit = calculateDailyCalories(weight, height, sex, goal, activity);
  const todayCalories = getTodayCalories();
  const percent = Math.min(100, Math.round((todayCalories / dailyLimit) * 100));

  document.getElementById('dailyLimit').textContent = dailyLimit;
  document.getElementById('dailyCalories').textContent = `Калории: ${todayCalories} / ${dailyLimit} ккал`;
  document.getElementById('caloriesProgress').style.width = `${percent}%`;
  document.getElementById('caloriesProgress').textContent = `${percent}%`;

  // Советы по питанию
  const remaining = dailyLimit - todayCalories;
  let advice = '';
  
  if (remaining < 0) {
    advice = `
      <h4>⚠️ Превышение нормы</h4>
      <p>Вы превысили дневную норму на ${Math.abs(remaining)} ккал. Рекомендуется:</p>
      <ul>
        <li>Увеличить физическую активность</li>
        <li>Следующий прием пищи сделать легким (овощи, белок)</li>
        <li>Пить больше воды</li>
      </ul>
    `;
  } else if (remaining < 200) {
    advice = `
      <h4>🎯 Почти достигли цели</h4>
      <p>Осталось ${remaining} ккал. Рекомендуется легкий ужин: овощной салат, кефир или творог.</p>
    `;
  } else if (percent < 50) {
    advice = `
      <h4>✅ Хороший прогресс</h4>
      <p>Вы употребили ${percent}% от нормы. Осталось ${remaining} ккал. Можно позволить себе полноценный обед или ужин.</p>
    `;
  } else {
    advice = `
      <h4>💪 Отличный баланс</h4>
      <p>Вы на правильном пути! Осталось ${remaining} ккал до цели. Следите за балансом БЖУ.</p>
    `;
  }

  // Дополнительные советы по цели
  if (goal === 'снижение' && percent > 80) {
    advice += `<p><strong>💡 Совет:</strong> Для снижения веса важно создать дефицит калорий. Следующий прием пищи должен быть легким и богатым белком.</p>`;
  } else if (goal === 'набор' && percent < 70) {
    advice += `<p><strong>💡 Совет:</strong> Для набора массы нужно больше калорий. Добавьте в рацион орехи, авокадо, цельнозерновые продукты.</p>`;
  }

  document.getElementById('dailyAdvice').innerHTML = advice;
  document.getElementById('dailyStats').style.display = 'block';
}

async function analyzeFood(image, userParams, reference) {
  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageBase64: image, 
        userParams,
        referenceType: reference,
        referenceSize: getReferenceSize(reference)
      })
    });
    
    // Читаем ответ как текст сначала
    const responseText = await res.text();
    
    if (!res.ok) {
      // Пытаемся распарсить как JSON
      let errorText = 'Ошибка сервера';
      try {
        const errorData = JSON.parse(responseText);
        errorText = errorData.error || errorData.message || errorText;
      } catch (e) {
        // Если не JSON, используем текст как есть
        errorText = responseText || `Ошибка ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorText);
    }
    
    // Парсим успешный ответ
    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error('Неверный формат ответа от сервера');
    }
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение и попробуйте снова.');
    }
    throw error;
  }
}

function getReferenceSize(ref) {
  const sizes = {
    card: 85.6,
    spoon: 200,
    glass: 70
  };
  return sizes[ref] || 85.6;
}

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'Анализ...';

  const userParams = {
    weight: +document.getElementById('weight').value,
    height: +document.getElementById('height').value,
    sex: document.getElementById('sex').value,
    goal: document.getElementById('goal').value,
    activity: document.getElementById('activity').value
  };

  const reference = document.getElementById('reference').value;

  try {
    const result = await analyzeFood(imageBase64, userParams, reference);
    
    // Сохраняем в историю
    const dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
    dayLog.push({ ...result, timestamp: new Date().toISOString() });
    localStorage.setItem('dayLog', JSON.stringify(dayLog));

    // Обновляем статистику
    updateDailyStats();

    // Рассчитываем процент от суточной нормы для этого блюда
    const weight = +document.getElementById('weight').value;
    const height = +document.getElementById('height').value;
    const sex = document.getElementById('sex').value;
    const goal = document.getElementById('goal').value;
    const activity = document.getElementById('activity').value;
    
    let percentFromDaily = '';
    if (weight && height) {
      const dailyLimit = calculateDailyCalories(weight, height, sex, goal, activity);
      const percent = Math.round((result.calories / dailyLimit) * 100);
      percentFromDaily = `<p style="background: #fff3e0; padding: 8px; border-radius: 6px; margin: 8px 0; font-weight: bold; color: #e65100;">
        📊 Это составляет <strong>${percent}%</strong> от вашей суточной нормы (${dailyLimit} ккал)
        <br><small>Цель: ${goal === 'снижение' ? 'Снижение веса' : goal === 'набор' ? 'Набор массы' : 'Поддержание веса'}</small>
      </p>`;
    }

    const refInfo = REFERENCE_SIZES[reference];
    document.getElementById('result').innerHTML = `
      <h2>✅ Результат анализа</h2>
      <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 12px 0;">
        <p><strong>Блюдо:</strong> ${result.dish}</p>
        <p><strong>Вес:</strong> ${result.weight_g} г</p>
        <p><strong>Калории:</strong> ${result.calories} ккал</p>
        ${percentFromDaily}
        <p><strong>Белки:</strong> ${result.nutrients.белки} г</p>
        <p><strong>Жиры:</strong> ${result.nutrients.жиры} г</p>
        <p><strong>Углеводы:</strong> ${result.nutrients.углеводы} г</p>
        ${result.ingredients?.length ? `<p><strong>Ингредиенты:</strong> ${result.ingredients.join(', ')}</p>` : ''}
        <p style="font-size: 12px; color: #666; margin-top: 8px;">📏 Референс: ${refInfo.name} (${refInfo.size})</p>
      </div>
      <p style="font-size: 14px; color: #666;">ℹ️ Данные сохранены в историю. Точность — ориентировочная.</p>
    `;
  } catch (e) {
    document.getElementById('result').innerHTML = `
      <h2>❌ Ошибка</h2>
      <pre style="color: red;">${e.message}</pre>
    `;
  }

  btn.disabled = false;
  btn.textContent = 'Анализировать снова';
});

// Очистить день
document.getElementById('clearDayBtn').addEventListener('click', () => {
  if (confirm('Очистить все записи за сегодня?')) {
    const today = new Date().toDateString();
    const dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
    const filtered = dayLog.filter(item => new Date(item.timestamp).toDateString() !== today);
    localStorage.setItem('dayLog', JSON.stringify(filtered));
    updateDailyStats();
    document.getElementById('result').innerHTML = '<p>История за сегодня очищена.</p>';
  }
});

// Показать историю
document.getElementById('showHistoryBtn').addEventListener('click', () => {
  const historyDiv = document.getElementById('history');
  if (historyDiv.style.display === 'none') {
    const dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
    const today = new Date().toDateString();
    const todayLog = dayLog.filter(item => new Date(item.timestamp).toDateString() === today);
    
    if (todayLog.length === 0) {
      historyDiv.innerHTML = '<p>История пуста.</p>';
    } else {
      historyDiv.innerHTML = '<h3>📋 История за сегодня</h3>' + todayLog.map((item, i) => `
        <div class="history-item">
          <strong>${i + 1}. ${item.dish}</strong> — ${item.calories} ккал (${item.weight_g} г)
          <br><small>${new Date(item.timestamp).toLocaleTimeString()}</small>
        </div>
      `).join('');
    }
    historyDiv.style.display = 'block';
  } else {
    historyDiv.style.display = 'none';
  }
});

// Обновлять статистику при изменении параметров
['weight', 'height', 'sex', 'goal', 'activity'].forEach(id => {
  document.getElementById(id).addEventListener('change', updateDailyStats);
});

// Инициализация при загрузке
updateDailyStats();