import styles from "./page.module.css";

import AudioRecorder from "./components/AudioRecorder";

// ---------------------------------------------------------------- //
// This is the main page of the app
// ---------------------------------------------------------------- //

export default function Home() {
  return (
    <div className={styles.page}>
      <h1>Microphone</h1>
      <main style={{width: "80%"}}>
        <div style={{border: "1px solid white", padding: "20px", borderRadius: "10px", backgroundColor: "rgba(255, 255, 255, 0.1)"}}>
          <AudioRecorder />
        </div>
      </main>
    </div>
  );
}
