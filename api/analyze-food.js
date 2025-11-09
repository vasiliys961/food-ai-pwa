let imageBase64 = null;

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

async function analyzeFood(image, userParams) {
  const res = await fetch('/api/analyze-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: image, userParams })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Ошибка сервера');
  }
  return res.json();
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

  try {
    const result = await analyzeFood(imageBase64, userParams);
    
    // Сохраняем в историю
    const dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
    dayLog.push({ ...result, timestamp: new Date().toISOString() });
    localStorage.setItem('dayLog', JSON.stringify(dayLog));

    document.getElementById('result').innerHTML = `
      <h2>Результат анализа</h2>
      <pre>${JSON.stringify(result, null, 2)}</pre>
      <p>ℹ️ Данные сохранены в историю. Точность — ориентировочная.</p>
    `;
  } catch (e) {
    document.getElementById('result').innerHTML = `
      <h2>Ошибка</h2>
      <pre>${e.message}</pre>
    `;
  }

  btn.disabled = false;
  btn.textContent = 'Анализировать снова';
});