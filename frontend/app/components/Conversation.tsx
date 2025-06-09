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

    const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/get_messages`;
    const requestType = "GET";
    const requestArgs = {
      user_id: userInfo.id,
      context: currentContext,
    };
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
