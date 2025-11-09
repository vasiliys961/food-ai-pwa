import React, { useState } from 'react';
import { sendFoodPhoto } from './api';

function App() {
  const [image, setImage] = useState(null);
  const [reference, setReference] = useState('карта');
  const [result, setResult] = useState(null);
  const [userParams, setUserParams] = useState({
      weight: 80, height: 180, sex: 'муж', goal: 'снижение', activity: 'активный'
  });
  const [loading, setLoading] = useState(false);

  const handleImageUpload = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const res = await sendFoodPhoto(image, userParams, reference);
    setResult(res);
    setLoading(false);
    let dayLog = JSON.parse(localStorage.getItem('dayLog') || '[]');
    dayLog.push(res);
    localStorage.setItem('dayLog', JSON.stringify(dayLog));
  };

  return (
    <div>
      <h1>Калории по фото — русскоязычный AI</h1>
      <div>
        <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} />
        <select value={reference} onChange={e => setReference(e.target.value)}>
          <option value="карта">Банковская карта</option>
          <option value="ложка">Ложка</option>
          <option value="стакан">Стакан</option>
        </select>
        {image && <img src={image} alt="Фото блюда" width={300}/>}
        <button onClick={handleAnalyze} disabled={!image || loading}>
          {loading ? 'Анализ...' : 'Анализировать'}
        </button>
      </div>
      <div>
        {/* Параметры пользователя – как раньше */}
      </div>
      <div>
        <h2>Результат анализа</h2>
        {result && <pre style={{background:'#eee', padding:'10px'}}>{JSON.stringify(result, null, 2)}</pre>}
        {result && result.error && <span style={{color:'red'}}>{result.error}</span>}
      </div>
    </div>
  );
}

export default App;
