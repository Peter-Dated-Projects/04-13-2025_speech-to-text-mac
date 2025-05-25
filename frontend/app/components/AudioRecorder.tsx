"use client";

import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import Image from "next/image";

import cstyles from "./styles/conversation.module.css";
import styles from "./styles/audio.module.css";

import { ConversationFetchItem } from "./ConversationSidebar";

// ------------------------------------------------------------ //
// io instance

const BACKEND_HOST = process.env.BACKEND_HOST || "localhost";
const BACKEND_PORT = process.env.BACKEND_PORT || "5001";

const socket = io(`${BACKEND_HOST}:${BACKEND_PORT}/streaming`, {
  transports: ["websocket"],
  autoConnect: false,
  reconnectionAttempts: 3,
  timeout: 10000,
  reconnectionDelay: 1000,
});

const STT_MODELS: ModelSelection[] = [
  { model: "base.en", model_id: "base.en" },
  { model: "small.en", model_id: "small.en" },
  { model: "medium.en", model_id: "medium.en" },
];

// ------------------------------------------------------------ //
// constants
// ---------------------------------------------------------------- //

const audioConstraints = {
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

// ------------------------------------------------------------ //
// interfaces
// ---------------------------------------------------------------- //

interface AudioRecorderProps {
  currentContext: ConversationFetchItem | null;
}

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface ModelSelection {
  model: string;
  model_id: string;
}

// ------------------------------------------------------------ //
// AudioRecorder component
// ---------------------------------------------------------------- //

const AudioRecorder: React.FC<AudioRecorderProps> = ({ currentContext }) => {
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

  // initialize socket in the useeffect to ensure proper cleanup
  useEffect(() => {
    return () => {
      // Clean up socket connection when component unmounts
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      // Clean up media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Function to handle Context Conversation
  useEffect(() => {
    if (currentContext) {
      console.log("Current Context:", currentContext);
      // TODO: Handle context changes (e.g., update UI or reset state)
    }
  }, [currentContext]);

  // Function to start the recording process
  const startRecording = async () => {
    setError(null);
    try {
      // Clean up previous resources if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create a fresh socket connection for each recording session
      socketRef.current = io(`${BACKEND_HOST}:${BACKEND_PORT}/streaming`, {
        transports: ["websocket"],
        autoConnect: false,
        reconnectionAttempts: 3,
        timeout: 10000,
        reconnectionDelay: 1000,
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setError("Socket connection error. Please try again.");
      });
      socketRef.current.on("connect_timeout", (error) => {
        console.error("Socket connection timeout:", error);
        setError("Socket connection timeout. Please try again.");
      });

      // Listen for the 'connect' event
      socketRef.current.on(
        "result_file_path",
        (data: { message: string; file_url: string; streaming_id: string }) => {
          // handle incoming audio file path
          console.log(data.message);
          console.log("Received streaming id:", data.streaming_id);
          console.log("Received file path:", data.file_url);
          setStreamingID(data.streaming_id);
          setAudioUrl(data.file_url);

          // request a transcript
          const _body = JSON.stringify({
            model: modelSelectRef.current?.value,
            streaming_id: data.streaming_id,
            audio_load_model: true,
          });
          console.log(_body);

          // TODO: remind to change to https when verified domain
          const _endpoint = `http://${BACKEND_HOST}:${BACKEND_PORT}/stt/transcribe_stream`;
          console.log("The Endpoint is: " + _endpoint);

          fetch(_endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: _body,
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error("Network response was not ok");
              }
              return response.json();
            })
            .then((data) => {
              // handle the response
              console.log(data);
              if (data && data.segments) {
                setTranscriptionValue(
                  data.segments.map((segment: [number, number, string]) => ({
                    start: segment[0],
                    end: segment[1],
                    text: segment[2],
                  }))
                );
              } else {
                setError("No transcription available");
              }
            })
            .catch((error) => {
              console.error("Error fetching transcription:", error);
              setError("Error fetching transcription");
            });

          // Disconnect the socket after receiving the file path
          socketRef.current.disconnect();
        }
      );

      // Connect the socket
      console.log("Connecting to socket...");
      socketRef.current.connect();
      setStreamingID(socketRef.current.id ? socketRef.current.id.toString() : null);

      // Request permission for audio input via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;

      // Create MediaRecorder instance

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 16000,
      });
      mediaRecorderRef.current = mediaRecorder;

      // Clear any previous audio chunks
      audioChunksRef.current = [];

      // On each data available event, send chunks to websocket connection
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          // store locally
          audioChunksRef.current.push(event.data);
          // send to websocket connection
          event.data
            .arrayBuffer()
            .then((buffer) => {
              // emit binary data as a chunk via socket connection
              if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit("audio_chunk", { chunk: buffer });
              }
            })
            .catch((err) => {
              console.error("Error converting audio chunk to ArrayBuffer:", err);
            });
        }
      };

      // When recording stops, combine all audio chunks and set the audio URL
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      // Start recording and request a new data chunk every 250ms
      mediaRecorder.start(250);
      setRecording(true);
    } catch (err: unknown) {
      setError("Unable to access the microphone. Please check permissions and try again.");
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
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Disconnect socket
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("stop_recording");
      }
      setStreamingID(null);
    }
  };

  return (
    <div className={cstyles["container-item"]}>
      <div className={styles["container"]}>
        <div className={styles["header"]}>
          <div>
            <Image src="/mic.jpeg" alt="mic" width={50} height={50} className={styles.image} />

            {/* Model Selection */}
            <div className={styles["model-selection"]}>
              <select ref={modelSelectRef}>
                {STT_MODELS.map((model) => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.model}
                  </option>
                ))}
              </select>
            </div>

            {/* Recording Button */}
            <div className={styles["record-button"]}>
              {!recording ? (
                <button onClick={startRecording}>Start Recording</button>
              ) : (
                <button onClick={stopRecording}>Stop Recording</button>
              )}
            </div>
          </div>
        </div>

        {/* Error Div -- to be removed (add in notifications instead???) */}
        <div>{error && <p>{error}</p>}</div>

        {/* Transcription and Audio Playback */}
        <div className={styles["content-container"]}>
          {/* Audio Playback */}
          <div className={styles["audio-container"]}>
            Hello
            {audioUrl && (
              <div>
                <h3>Playback</h3>
                <audio controls src={audioUrl}></audio>
              </div>
            )}
          </div>

          {/* Transcriptions */}
          <div className={styles["transcription-container"]}>
            <h3>Transcription</h3>
            <div>
              {transcriptionValue
                ? transcriptionValue.map((item, index) => (
                    <div key={index}>
                      <span>
                        {item.start} - {item.end}
                      </span>
                      <span>{item.text}</span>
                    </div>
                  ))
                : "No transcription available"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
