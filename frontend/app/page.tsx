"use client";
import styles from "./styles/page.module.css";

import ConversationSidebar from "./components/ConversationSidebar";

import { useState, useEffect } from "react";
import { ConversationFetchItem } from "./components/ConversationSidebar";

import ConversationContainer from "./components/ConversationContent";

// ---------------------------------------------------------------- //
// Interfaces
// ---------------------------------------------------------------- //

interface UserInformation {
  id: string;
}

export type { UserInformation };

// ---------------------------------------------------------------- //
// Functions+ etc
// ---------------------------------------------------------------- //

// ---------------------------------------------------------------- //
// This is the main page of the app
// ---------------------------------------------------------------- //

export default function Home() {
  // states
  const [currentConversation, setCurrentConversation] = useState<ConversationFetchItem | null>(
    null
  );
  const [currentUserID, setCurrentUserID] = useState<UserInformation>({ id: "" });

  function handleConversationClick(conversation: ConversationFetchItem) {
    console.log("Conversation clicked:", conversation);
    setCurrentConversation(conversation);
  }

  // TODO - remove this later
  // check if the default user is created
  useEffect(() => {
    // try to create a user
    const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/create_user`;
    console.log("Target URL:", target_url);

    const defaultUser = {
      first_name: "Default",
      last_name: "User",
      password: "default_password",
      email: "default_user@example.com",
    };

    fetch(target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(defaultUser),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.code === "409") {
          console.error("User already exists:", data);
          setCurrentUserID({ id: data.testid });
          return;
        }
        console.log("User created:", data);
        setCurrentUserID({ id: data.id });
      })
      .catch((error) => {
        console.error("Error creating user:", error);
      });
  }, []);

  return (
    <main className={styles.container}>
      <div className={styles["content-grid"]}>
        <ConversationSidebar
          onConversationClick={handleConversationClick}
          userInfo={currentUserID}
        />
        <div className={styles["content-container"]}>
          <ConversationContainer currentContext={currentConversation} userInfo={currentUserID} />
        </div>
      </div>
    </main>
  );
}
