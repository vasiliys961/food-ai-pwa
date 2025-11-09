let imageBase64 = null;
let resultDiv = document.getElementById('result');
let logDiv = document.getElementById('log');

document.getElementById('analyzeBtn').onclick = async function () {
  if (!imageBase64) {
    resultDiv.textContent = 'Фото не выбрано!';
    return;
  }
  resultDiv.textContent = 'Анализ...';

  // ВСТАВЬТЕ ЭТУ СТРОКУ прямо здесь!
  console.log(typeof imageBase64, imageBase64.length, imageBase64.slice(0,100));

  const reader = new FileReader();
  reader.onloadend = () => {
    // Отображаем превью — можно оставить полный base64 для <img>
    document.getElementById('preview').src = reader.result;

    // Обрезаем префикс типа, оставляя только base64 для API
    const base64 = reader.result;
    const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    imageBase64 = pureBase64;
  };
  reader.readAsDataURL(file);
});

document.getElementById('analyzeBtn').onclick = async function () {
  if (!imageBase64) {
    resultDiv.textContent = 'Фото не выбрано!';
    return;
  }
  resultDiv.textContent = 'Анализ...';
  const userParams = {
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    sex: document.getElementById('sex').value,
    goal: document.getElementById('goal').value,
    activity: document.getElementById('activity').value
  };
  const reference = document.getElementById('reference').value;
  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, userParams, reference })
    });
    const data = await res.json();
    if (data.error) {
      resultDiv.textContent = data.error;
      logDiv.textContent = data.debug || '';
    } else {
      resultDiv.textContent = "Результат:\n" + JSON.stringify(data, null, 2);
      let dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
      dayLog.push(data);
      localStorage.setItem('dayLog', JSON.stringify(dayLog));
    }
  } catch (e) {
    resultDiv.textContent = 'Ошибка сети: ' + e.message;
  }
}
let imageBase64 = null;
let resultDiv = document.getElementById('result');
let logDiv = document.getElementById('log');

document.getElementById('fileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    // Отображаем превью — можно оставить полный base64 для <img>
    document.getElementById('preview').src = reader.result;

    // Обрезаем префикс типа, оставляя только base64 для API
    const base64 = reader.result;
    const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    imageBase64 = pureBase64;
  };
  reader.readAsDataURL(file);
});

document.getElementById('analyzeBtn').onclick = async function () {
  if (!imageBase64) {
    resultDiv.textContent = 'Фото не выбрано!';
    return;
  }
  resultDiv.textContent = 'Анализ...';
  const userParams = {
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    sex: document.getElementById('sex').value,
    goal: document.getElementById('goal').value,
    activity: document.getElementById('activity').value
  };
  const reference = document.getElementById('reference').value;
  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, userParams, reference })
    });
    const data = await res.json();
    if (data.error) {
      resultDiv.textContent = data.error;
      logDiv.textContent = data.debug || '';
    } else {
      resultDiv.textContent = "Результат:\n" + JSON.stringify(data, null, 2);
      let dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
      dayLog.push(data);
      localStorage.setItem('dayLog', JSON.stringify(dayLog));
    }
  } catch (e) {
    resultDiv.textContent = 'Ошибка сети: ' + e.message;
  }
}
