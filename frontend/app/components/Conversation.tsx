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
  const [isLoadingMessages, setIsLoadingMessages] = React.useState<boolean>(false);
  const [messageError, setMessageError] = React.useState<string | null>(null);

  // functions
  const fetchMessages = React.useCallback(async () => {
    if (!currentContext || !userInfo) {
      setMessages([]);
      setMessageError(null);
      setIsLoadingMessages(false);
      return;
    }

    const conversation_id = currentContext.id; // Assuming currentContext.id is the conversation_id
    if (!conversation_id) {
      console.error("Conversation ID is missing.");
      setMessages([]);
      setMessageError("Cannot load messages: Conversation ID is missing.");
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    setMessageError(null);

    const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/get_conversation_messages?conversation_id=${conversation_id}`;

    try {
      const response = await fetch(target_url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok" && data.messages) {
          setMessages(data.messages);
          console.log("Fetched messages:", data.messages);
        } else {
          console.error("Failed to fetch messages:", data.message || "Unknown error");
          setMessages([]);
          setMessageError(data.message || "Failed to fetch messages.");
        }
      } else {
        console.error("Error fetching messages:", response.statusText);
        setMessages([]);
        setMessageError(`Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Network error fetching messages:", error);
      setMessages([]);
      setMessageError("Network error. Please check your connection.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentContext, userInfo]);

  // effects
  React.useEffect(() => {
    // Only fetch messages if there's a current context (conversation selected)
    if (currentContext && currentContext.id) {
      fetchMessages();
    } else {
      // No conversation selected, clear messages and any errors.
      setMessages([]);
      setMessageError(null);
      setIsLoadingMessages(false);
    }
  }, [currentContext, fetchMessages]); // fetchMessages is memoized and includes currentContext in its deps

  let content;
  if (!currentContext) {
    content = <div className={styles["messages-info"]}>Select a conversation to view messages.</div>;
  } else if (isLoadingMessages) {
    content = <div className={styles["messages-info"]}>Loading messages...</div>;
  } else if (messageError) {
    content = <div className={styles["messages-error"]}>{messageError}</div>;
  } else if (messages.length === 0) {
    content = <div className={styles["messages-info"]}>No messages yet in this conversation.</div>;
  } else {
    content = messages.map((msg, index) => (
      <MessageItem key={msg.id || index} message={msg} /> // Assuming msg might have an id
    ));
  }

  return (
    <div className={styles["container-item"]}>
      <div className={styles["conversation-container"]}>
        {/* Optional: Display conversation title */}
        {currentContext && <h2 className={styles["conversation-title"]}>{currentContext.name || currentContext.title}</h2>}
        <div className={styles["messages-list"]}>
          {content}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- //
// MessageItem Component
// ---------------------------------------------------------------- //

interface Message {
  id?: string;
  text: string;
  user_id: string;
  created_at: string;
}

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { text, user_id, created_at } = message;
  // Ensure created_at is valid before parsing. Fallback or error handling might be needed.
  const displayTimestamp = created_at ? new Date(created_at).toLocaleString() : "Invalid date";

  return (
    <div className={styles["message-item"]}>
      <div className={styles["message-header"]}>
        <span className={styles["message-user"]}>{user_id || "Anonymous"}</span>
        <span className={styles["message-timestamp"]}>{displayTimestamp}</span>
      </div>
      <div className={styles["message-text"]}>{text}</div>
    </div>
  );
};

export default Conversation;
