"use client";

import React from "react";
import { ConversationContainerProps } from "./ConversationContent";

import styles from "./styles/conversation.module.css";

// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

// ---------------------------------------------------------------- //
// Conversation Component
// ---------------------------------------------------------------- //

function Conversation({ currentContext, userInfo }: ConversationContainerProps) {
  // states
  const [messages, setMessages] = React.useState<any[]>([]);

  // functions
  function fetchMessages() {
    // function fetches messages from server
  }

  // effects

  return (
    <div className={styles["container-item"]}>
      <div className={styles["conversation-container"]}>
        <div>Hello World</div>
      </div>
    </div>
  );
}

export default Conversation;
