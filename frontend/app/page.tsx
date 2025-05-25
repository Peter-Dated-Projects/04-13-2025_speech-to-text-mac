
"use client";
import styles from "./styles/page.module.css";

import ConversationSidebar from "./components/ConversationSidebar";

import { useState } from "react";
import { ConversationFetchItem } from "./components/ConversationSidebar";

import ConversationContainer from "./components/ConversationContent";

// ---------------------------------------------------------------- //
// Functions+ etc
// ---------------------------------------------------------------- //



// ---------------------------------------------------------------- //
// This is the main page of the app
// ---------------------------------------------------------------- //

export default function Home() {
  // states
  const [currentConversation, setCurrentConversation] = useState<ConversationFetchItem | null>(null);

  function handleConversationClick(conversation: ConversationFetchItem) {
    console.log("Conversation clicked:", conversation);
    setCurrentConversation(conversation);
  }

  return (
      <main className={styles.container}>

        <div className={styles["content-grid"]}>
          <ConversationSidebar onConversationClick={handleConversationClick} />
          <div className={styles["content-container"]}>
            <ConversationContainer currentContext={currentConversation} />
          </div>
        </div>

      </main>
  );
}
