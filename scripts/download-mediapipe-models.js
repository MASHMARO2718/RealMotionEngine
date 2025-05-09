const fs = require('fs');
const path = require('path');
const https = require('https');

// ダウンロードするモデルのURL
const MODEL_URLS = {
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'gesture_recognizer.task': 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
};

// モデルを保存するディレクトリ
const MODELS_DIR = path.join(__dirname, '../public/models');

// ディレクトリが存在することを確認
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`ディレクトリを作成しました: ${MODELS_DIR}`);
}

// ファイルをダウンロードする関数
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`ダウンロード中: ${url}`);
    
    const file = fs.createWriteStream(destination);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`ダウンロードエラー: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`ダウンロード完了: ${destination}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destination, () => {}); // ファイルが存在する場合は削除
      reject(err);
    });
  });
}

// すべてのモデルをダウンロード
async function downloadAllModels() {
  for (const [fileName, url] of Object.entries(MODEL_URLS)) {
    const destination = path.join(MODELS_DIR, fileName);
    
    // ファイルが既に存在するかチェック
    if (fs.existsSync(destination)) {
      console.log(`ファイル ${fileName} は既に存在します。スキップします。`);
      continue;
    }
    
    try {
      await downloadFile(url, destination);
    } catch (error) {
      console.error(`${fileName} のダウンロード中にエラーが発生しました:`, error);
    }
  }
  
  console.log('すべてのダウンロードが完了しました。');
}

// ダウンロードを実行
downloadAllModels().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
}); 