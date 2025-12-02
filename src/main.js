let imageBase64 = null;
let fileLoaded = false;
let resultDiv = document.getElementById('result');
let logDiv = document.getElementById('log');

document.getElementById('fileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    document.getElementById('preview').src = reader.result;
    const base64 = reader.result;
    const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    imageBase64 = pureBase64;
        fileLoaded = true;
  };
  reader.readAsDataURL(file);
});

document.getElementById('analyzeBtn').onclick = async function () {
  if (!fileLoaded || !imageBase64) {    resultDiv.textContent = 'Фото не выбрано!';
    return;
  }

  resultDiv.textContent = 'Анализ...';
  logDiv.textContent = '';

  const userParams = {
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    sex: document.getElementById('sex').value,
    goal: document.getElementById('goal').value,
    activity: document.getElementById('activity').value
  };

  const reference = document.getElementById('reference').value;

  try {
    const apiUrl = window.location.origin + '/api/analyze-food';
    
    
        console.log('Sending imageBase64:', imageBase64 ? imageBase64.substring(0, 100) + '...' : 'NULL');
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, userParams, reference })
    });

    if (!res.ok) {
      const errorData = await res.json();
      resultDiv.textContent = `❌ Ошибка ${res.status}: ${errorData.error || 'Неизвестная ошибка'}`;
      if (errorData.debug) {
        logDiv.textContent = 'Подробно:\n' + errorData.debug;
      }
      return;
    }

    const data = await res.json();

    if (data.error) {
      resultDiv.textContent = '❌ ' + data.error;
      logDiv.textContent = data.debug || '';
    } else {
      resultDiv.innerHTML = `
        <strong>✅ Результат:</strong>
        <div style="margin-top: 10px;">
          <p><strong>Блюдо:</strong> ${data.dish}</p>
          <p><strong>Вес:</strong> ${data.weight_g}г</p>
          <p><strong>Ингредиенты:</strong> ${data.ingredients.join(', ')}</p>
          <p><strong>Калории:</strong> ${data.calories} ккал</p>
        </div>
      `;
      
      let dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
      dayLog.push({
        ...data,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('dayLog', JSON.stringify(dayLog));
    }
  } catch (e) {
    resultDiv.textContent = '❌ Ошибка сети: ' + e.message;
    console.error('Fetch error:', e);
  }
};


