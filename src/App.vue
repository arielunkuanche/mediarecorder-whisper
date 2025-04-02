<template>
  <div class="container">
    <h2>MediaRecorder Whisper Transcription Test</h2>
    <div class="buttons">
      <button @click="startRecording" :disabled="isRecording">Start Recording</button>
      <button @click="stopRecording" :disabled="!isRecording">Stop Recording</button>
    </div>

    <div v-if="isTranscribing">Transcribing, please wait...</div>

    <p><strong>Live Transcript Output:</strong></p>
    <pre>{{ transcript }}</pre>

    <h3 v-if="recordingHistory.length">Voice History</h3>
    <ul class="history-list">
      <li v-for="(entry, index) in recordingHistory" :key="index">
        <p><strong>{{ entry.timestamp?.toDate().toLocaleString() }}</strong></p>
        <p>{{ entry.finalTranscript }}</p>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from './firebaseConfig';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

const isRecording = ref(false);
const isTranscribing = ref(false);
const transcript = ref('');
const recordingHistory = ref([]);

let mediaRecorder;
let chunks = []; 
// let intervalId;
const validChunksQueue = ref([]);
const isProcessingQueue = ref(false);


const transcribeChunk = async (chunk) => {
  console.log("transcribeChunk received chunk: ", chunk);

  const blob = new Blob([chunk], { type: 'audio/webm' }); 
  const formData = new FormData();
  formData.append('file', blob, 'chunk.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  formData.append('language', 'en');

  for (const [key, val] of formData.entries()) {
    console.log(`[formData] ${key}:`, val);
  }

  isTranscribing.value = true;
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  console.log("key ", import.meta.env.VITE_OPENAI_API_KEY);
  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: formData,
    });
    console.log("Whisper response:", res);

    if (!res.ok) {
      const error = await res.json();
      console.error("Whisper error:", error.error);
      // transcript.value += '\n[Error] ' + error.error?.message;
      isTranscribing.value = false;
      return;
    }
    const text = await res.text();
    transcript.value += '\n' + text;

  } catch (err) {
    transcript.value += '\n[Error]: ' + err.message;
  }

  isTranscribing.value = false;
};

const processNextChunk = async () => {
  if (validChunksQueue.value.length === 0) {
    isProcessingQueue.value = false;
    return;
  }

  isProcessingQueue.value = true;
  const chunk = validChunksQueue.value.shift();
  await transcribeChunk(chunk);
  setTimeout(() => processNextChunk(), 200);
};

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  transcript.value = '';
  chunks = [];

  const preferredType = 'audio/webm;codecs=opus';
  const options = MediaRecorder.isTypeSupported(preferredType)
    ? { mimeType: preferredType }
    : { mimeType: 'audio/webm' };
  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = async (e) => {
    console.log("ondataavailable triggered, size is:", e.data.size);
    if (e.data && e.data.size > 500) {
      //const chunkBlob = new Blob([e.data], { type: 'audio/webm' });
      const chunkBlob = e.data;
      console.log("Individual chunkBlob in ondataavailable: ", chunkBlob);
      chunks.push(chunkBlob);
      validChunksQueue.value.push(chunkBlob);

      if (!isProcessingQueue.value) processNextChunk();
    } else {
      console.log("Chunk is empty or too small in startRecording.");
    }
  };

  mediaRecorder.start(5000);

  // intervalId = setInterval(() => {
  //   if (mediaRecorder && mediaRecorder.state === 'recording') {
  //     console.log("Requesting data chunk... in intervalId");
  //     mediaRecorder.requestData();
  //   }
  // }, 5000);

  isRecording.value = true;
};

const stopRecording = async () => {
  //if (intervalId) clearInterval(intervalId);
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isRecording.value = false;

  setTimeout(async () => {
    //const fullBlob = new Blob(chunks, { type: 'audio/webm' });
    //const localUrl = URL.createObjectURL(fullBlob); used only when enable replay the audio history in Firebase

    const docRef = await addDoc(collection(db, 'voiceHistory'), {
      finalTranscript: transcript.value,
      timestamp: serverTimestamp(),
    });

    recordingHistory.value.unshift({
      id: docRef.id,
      finalTranscript: transcript.value,
      timestamp: { toDate: () => new Date() },
    });

  }, 500);
};

const loadHistory = async () => {
  const querySnapshot = await getDocs(collection(db, 'voiceHistory'));
  recordingHistory.value = querySnapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  })).sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
};

onMounted(() => {
  loadHistory();
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
