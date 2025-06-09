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
  const [allConversations, setAllConversations] = useState<ConversationFetchItem[]>([]);
  const [currentUserID, setCurrentUserID] = useState<UserInformation>({ id: "" });

  function handleConversationClick(conversation: ConversationFetchItem) {
    console.log("Conversation clicked:", conversation);
    setCurrentConversation(conversation);
  }

  function handleConversationsFetched(conversations: ConversationFetchItem[]) {
    setAllConversations(conversations);
    console.log("All conversations fetched in page:", conversations);
  }

  // Effect for default conversation selection
  useEffect(() => {
    if (allConversations.length > 0 && currentConversation === null) {
      console.log("Attempting to set default conversation...");
      // Create a mutable copy for sorting
      const sortedConversations = [...allConversations].sort((a, b) => {
        // Assuming updated_at.$date is an ISO string
        return new Date(b.updated_at.$date).getTime() - new Date(a.updated_at.$date).getTime();
      });

      if (sortedConversations.length > 0) {
        setCurrentConversation(sortedConversations[0]);
        console.log("Default conversation set to:", sortedConversations[0].title, sortedConversations[0]._id.$oid);
      }
    }
  }, [allConversations, currentConversation]);


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
          // console.error("User already exists:", data);
          console.log("Default user already exists with ID:", data.testid);
          setCurrentUserID({ id: data.testid });
          return;
        }
        console.log("Default user created with ID:", data.id);
        setCurrentUserID({ id: data.id });
      })
      .catch((error) => {
        console.error("Error creating/fetching default user:", error);
      });
  }, []);

  return (
    <main className={styles.container}>
      <div className={styles["content-grid"]}>
        <ConversationSidebar
          onConversationClick={handleConversationClick}
          userInfo={currentUserID}
          onConversationsFetched={handleConversationsFetched}
        />
        <div className={styles["content-container"]}>
          <ConversationContainer currentContext={currentConversation} userInfo={currentUserID} />
        </div>
      </div>
    </main>
  );
}
