"use client";
import React, { useState, useEffect, useRef } from 'react';
import io from "socket.io-client";
import Image from 'next/image';
import styles from "../page.module.css";

// ------------------------------------------------------------ //

// io instance
const socket = io("http://localhost:3000/streaming", {
  transports: ['websocket'],
  autoConnect: false,
  reconnectionAttempts: 3,
  timeout: 10000,
  reconnectionDelay: 1000,
});


const STT_MODELS: ModelSelection[] = [
  { model: 'base.en', model_id: 'base.en' },
  { model: 'small.en', model_id: 'small.en' },
  { model: 'medium.en', model_id: 'medium.en' },
];


// ------------------------------------------------------------ //

const audioConstraints = {
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  }       
}

interface Segment {
  start: number;
  end: number;
  text: string;
};


interface ModelSelection {
  model: string;
  model_id: string;
};


// ------------------------------------------------------------ //

const AudioRecorder: React.FC = () => {

  // states
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [, setStreamingID] = useState<string | null>(null);
  
  // Refs to store the MediaRecorder instance and captured audio chunks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const socketRef = useRef(socket);
  const streamRef = useRef<MediaStream | null>(null);
  const modelSelectRef = useRef<HTMLSelectElement | null>(null);

  // for transcription
  const [transcriptionValue, setTranscriptionValue] = useState<Segment[] | null>(null);

  // innitialize socket in the useeffect to ensure proper cleanup
  useEffect(() => {
    return () => {
      // Clean up socket connection when component unmounts
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      // Clean up media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }, []);


  // Function to start the recording process
  const startRecording = async () => {
    setError(null);
    try {
      // Clean up previous resources if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create a fresh socket connection for each recording session
      socketRef.current = io("http://localhost:3000/streaming", {
        transports: ['websocket'],
        autoConnect: false,
        reconnectionAttempts: 3,
        timeout: 10000,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('result_file_path', (data: { message: string; file_url: string; streaming_id: string; }) => {
        // handle incoming audio file path
        console.log(data.message);
        console.log('Received streaming id:', data.streaming_id);
        console.log('Received file path:', data.file_url);
        setStreamingID(data.streaming_id);
        setAudioUrl(data.file_url);

        // request a transcript
        const _body = JSON.stringify({
          model: modelSelectRef.current?.value,
          streaming_id: data.streaming_id,
          audo_load_model: true
        })
        console.log(_body)

        fetch(`http://localhost:3000/stt/transcribe_stream`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: _body,
        })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then((data) => {
          // handle the response
          console.log(data);
          if (data && data.segments) {
            setTranscriptionValue(data.segments.map((segment: [number, number, string]) => ({
              start: segment[0],
              end: segment[1],
              text: segment[2],
            })));
          } else {
            setError('No transcription available');
          }
        })
        .catch((error) => {
          console.error('Error fetching transcription:', error);
          setError('Error fetching transcription');
        });

        // Disconnect the socket after receiving the file path
        socketRef.current.disconnect();
      });


      // Connect the socket
      socketRef.current.connect();
      setStreamingID(socketRef.current.id ? socketRef.current.id.toString() : null);

      // Request permission for audio input via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;

      // Create MediaRecorder instance
      
      const mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 16000});
      mediaRecorderRef.current = mediaRecorder;
      
      // Clear any previous audio chunks
      audioChunksRef.current = [];
      
      // On each data available event, send chunks to websocket connection
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          // store locally
          audioChunksRef.current.push(event.data);
          // send to websocket connection
          event.data.arrayBuffer().then((buffer) => {
            // emit binary data as a chunk via socket connection
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('audio_chunk', {chunk: buffer});
            }
          }).catch((err) => {
            console.error('Error converting audio chunk to ArrayBuffer:', err);
          });
        }
      };
      
      // When recording stops, combine all audio chunks and set the audio URL
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };
      
      // Start recording and request a new data chunk every 250ms
      mediaRecorder.start(250);
      setRecording(true);
    } catch (err: unknown) {
      setError('Unable to access the microphone. Please check permissions and try again.');
      console.error(err);
    }
  };

  
  // Function to stop the recording process
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('stop_recording');
      }
      setStreamingID(null);
    }
  };

  
  return (
    <div>
      <div style={{display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px"}}>
        <Image
          src="/mic.jpeg"
          alt="Microphone"
          width={50}
          height={50}
          className={styles.image}
        />
        {/* a text selection dropdown */}
        <select ref={modelSelectRef} className={styles.select} style={{width: "100px"}}>
          {STT_MODELS.map((model) => (
            <option key={model.model_id} value={model.model_id}>
              {model.model}
            </option>
          ))}
        </select>
      </div>

      <h2>Audio Recorder</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!recording ? (
        <button onClick={startRecording}>Start Recording</button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}
      <div style={{height: "100px", border: "1px solid white", marginTop: "10px", padding: "10px"}}>
        {audioUrl && (
        <div>
          <h3>Playback</h3>
          <audio controls src={audioUrl} style={{position: "relative", width: "100%"}}></audio>
        </div>
      )}
      </div>
      <div style={{minHeight: "100px", border: "1px solid white", marginTop: "10px", padding: "10px", width:"100%"}}>
        <h3>Transcription</h3>
        <p>{transcriptionValue ? transcriptionValue.map((item, index) => (
          <div key={index} style={{display: "grid", gridTemplateColumns: "100px auto", gap: "10px", alignItems: "center", padding: "5px", borderBottom: "1px solid rgba(255, 255, 255, 0.5)"}}>
            <span>{item.start} - {item.end}</span>
            <span>{item.text}</span>
          </div>
        )) : 'No transcription available'}</p>
      </div>
    </div>
  );
};

export default AudioRecorder;