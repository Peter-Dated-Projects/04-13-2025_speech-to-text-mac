"use client";
import React, { useEffect } from "react";

import styles from "../styles/page.module.css";

import { SidebarIcon, SearchIcon, NewChatIcon } from "./icons";
import Icon from "./icons";

import { UserInformation } from "../page";

// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

// This represents the full conversation object fetched from the backend
interface ConversationFetchItem {
  _id: { $oid: string }; // Keep original MongoDB ID structure
  title: string;
  description: string;
  audio_data?: string; // Optional fields based on previous definition
  audio_duration?: number;
  compressed?: boolean;
  segment_ids?: string[];
  created_at: { $date: string }; // Keep original MongoDB date structure
  updated_at: { $date: string }; // Keep original MongoDB date structure
  participants_ids?: string[];
}

// Props for the individual item display in the sidebar
interface SideBarDisplayItemProps {
  id: string; // Actual ID string
  name: string;
  description: string;
  updated_at: string; // Store as ISO string for sortability, format for display
}


interface ConversationSidebarProps {
  onConversationClick: (conversation: ConversationFetchItem) => void; // Pass full item
  userInfo: UserInformation;
  onConversationsFetched?: (conversations: ConversationFetchItem[]) => void;
}


// ---------------------------------------------------------------- //
// updateSidebar
// ---------------------------------------------------------------- //

function retrieveConversations(userInfo: UserInformation): Promise<ConversationFetchItem[]> {
  // fetch conversations from the backend
  console.log("Fetching conversations...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/get_conversations`;
  const requestType = "GET";
  const requestArgs = {
    user_id: userInfo.id,
  };

  // Create the final request URL with query parameters
  const finalRequestURL = new URL(target_url);
  if (!requestArgs.user_id) {
    console.error("User ID is missing for retrieveConversations");
    return Promise.resolve([]); // Return empty if no user_id
  }
  finalRequestURL.searchParams.append("user_id", requestArgs.user_id);

  console.log("Target URL:", finalRequestURL.toString());

  // Request to fetch conversations
  return fetch(finalRequestURL.toString(), {
    method: requestType,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
    .then((response) => {
      console.log("Response status:", response);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      // Ensure data has conversations and it's an array
      if (data && data.conversations && Array.isArray(data.conversations)) {
        // Directly return conversations if they match ConversationFetchItem structure
        // The backend returns _id: { $oid: string }, title, description, updated_at: { $date: string } etc.
        // This matches ConversationFetchItem if we define it carefully.
        console.log("Fetched conversations (raw):", data.conversations);
        return data.conversations as ConversationFetchItem[];
      } else {
        console.warn("No conversations found or data in unexpected format:", data);
        return [];
      }
    })
    .catch((error) => {
      console.error("Error fetching conversations:", error);
      return []; // Return empty array on error
    });
}


function createNewConversation(userInfo: UserInformation): Promise<ConversationFetchItem | null> {
  // grab the test user information
  if (!userInfo || !userInfo.id) {
    console.error("User information is not available for createNewConversation");
    return Promise.resolve(null);
  }

  // APPROVED - create a new conversation in the database
  console.log("creating new conversation...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/create_conversation`;
  console.log("Target URL:", target_url);

  const information = {
    user_id: userInfo.id, // Make sure UserInformation has id
    data: {
      // title: "New Conversation", // Optionally set a default title
      description: "This is a new conversation.",
      participants: [userInfo.id],
      // No need to send created_at/updated_at from client for new conversation
    },
  };

  return fetch(target_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(information),
  })
    .then((response) => {
      console.log("Response status:", response);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      // The backend returns the created conversation object with _id, title, description, updated_at ($date)
      // This should match ConversationFetchItem structure
      if (data && data._id && data._id.$oid && data.title && data.updated_at && data.updated_at.$date) {
        console.log("New conversation created (raw):", data);
        // Constructing an object that matches ConversationFetchItem
        // The backend response already includes _id as an object {$oid: string}
        // and updated_at as an object {$date: string}
        const newConversation: ConversationFetchItem = {
            _id: data._id, // e.g. {$oid: "actual_id_string"}
            title: data.title,
            description: data.description || "",
            created_at: data.created_at || { $date: new Date().toISOString() }, // Fallback if not sent by backend
            updated_at: data.updated_at, // e.g. {$date: "iso_string"}
            // other fields can be undefined or have defaults if not in response
            audio_data: data.audio_data,
            audio_duration: data.audio_duration,
            compressed: data.compressed,
            segment_ids: data.segment_ids || [],
            participants_ids: data.participants_ids || [userInfo.id!]
        };
        return newConversation;
      } else {
        console.error("Created conversation data in unexpected format:", data);
        return null;
      }
    })
    .catch((error) => {
      console.error("Error creating new conversation:", error);
      return null;
    });
}

// ---------------------------------------------------------------- //
// Conversation Sidebar
// ---------------------------------------------------------------- //

// Props for SideBarItem - it only needs a few fields for display
interface SideBarItemDisplayProps {
  item: ConversationFetchItem; // Pass the full item
  onClick: () => void; // Click handler
}

function SideBarItem({ item, onClick }: SideBarItemDisplayProps) {
  // Use item.title and item.updated_at.$date for display
  const name = item.title;
  const dateStr = item.updated_at.$date; // This is an ISO string

  const date = new Date(dateStr);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const currentDate = new Date();
  const isSameDay =
    date.getDate() === currentDate.getDate() &&
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear();

  return (
    <div
      className={styles["sidebar-list-item"]}
      onClick={onClick} // Use the passed onClick handler
    >
      <h3>{name}</h3>
      <small>Updated at: {isSameDay ? time : date.toDateString()}</small>
    </div>
  );
}

// ---------------------------------------------------------------- //
// Conversation Sidebar
// ---------------------------------------------------------------- //

function ConversationSidebar({ onConversationClick, userInfo, onConversationsFetched }: ConversationSidebarProps) {
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [dbConversations, setDBConversations] = React.useState<ConversationFetchItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = React.useState<boolean>(false);
  const [conversationError, setConversationError] = React.useState<string | null>(null);

  function toggleSidebar() {
    setShowSidebar(!showSidebar);
  }

  const handleRefreshConversations = React.useCallback(() => {
    if (!userInfo || !userInfo.id) {
      console.warn("User information is not available for refreshing conversations. Skipping fetch.");
      setDBConversations([]);
      setConversationError(null); // Clear previous errors
      setIsLoadingConversations(false); // Not loading if no user
      if (onConversationsFetched) {
        onConversationsFetched([]);
      }
      return;
    }

    setIsLoadingConversations(true);
    setConversationError(null);

    retrieveConversations(userInfo)
      .then((data) => {
        console.log("Conversations data:", data);
        setDBConversations(data);
        if (onConversationsFetched) {
          onConversationsFetched(data);
        }
      })
      .catch((error) => {
        console.error("Error fetching conversations:", error);
        setDBConversations([]);
        setConversationError("Failed to load conversations.");
        if (onConversationsFetched) {
          onConversationsFetched([]);
        }
      })
      .finally(() => {
        setIsLoadingConversations(false);
      });
  }, [userInfo, onConversationsFetched]);

  useEffect(() => {
    handleRefreshConversations();
  }, [handleRefreshConversations]); // Runs on component mount and when userInfo changes

  const handleCreateNewConversation = () => {
    if (!userInfo || !userInfo.id) {
        console.error("User information is not available for creating conversation.");
        return;
    }
    // Optionally, set loading/error states for create operation if it's slow
    createNewConversation(userInfo).then((newConversation) => {
      if (newConversation) {
        const updatedConversations = [...dbConversations, newConversation];
        setDBConversations(updatedConversations);
        if (onConversationsFetched) {
          onConversationsFetched(updatedConversations);
        }
        onConversationClick(newConversation);
      } else {
        // Optionally, set an error state for creation failure
        console.error("Failed to create new conversation or newConversation is null");
        // alert("Failed to create new conversation."); // Simple error feedback
      }
    });
  };

  let conversationContent;
  if (isLoadingConversations) {
    conversationContent = <p className={styles["sidebar-message"]}>Loading conversations...</p>;
  } else if (conversationError) {
    conversationContent = <p className={styles["sidebar-message-error"]}>{conversationError}</p>;
  } else if (dbConversations.length === 0) {
    conversationContent = <p className={styles["sidebar-message"]}>No conversations found.</p>;
  } else {
    conversationContent = dbConversations.map((conversation, i) => (
      <SideBarItem
        key={conversation._id.$oid || i}
        item={conversation}
        onClick={() => onConversationClick(conversation)}
      />
    ));
  }

  return (
    <div className={styles["sidebar-container"]}>
      <div className={styles["sidebar-header"]}>
        <Icon
          svg={<SidebarIcon />}
          clickFunction={toggleSidebar}
          css={styles["sidebar-icon-button"]}
        />
        <button onClick={handleRefreshConversations} disabled={isLoadingConversations}>
          {isLoadingConversations ? "Refreshing..." : "Refresh"}
        </button>
        <Icon
          svg={<NewChatIcon />}
          clickFunction={handleCreateNewConversation}
          css={styles["sidebar-icon-button"]}
          // disabled={isLoadingConversations} // Consider disabling during load
        />
      </div>

      <div
        style={{
          padding: "12px 16px",
          border: "1px solid #eee",
          borderRadius: "5px",
          textWrap: "nowrap",
          overflow: "hidden",
          overflowX: "auto",
          color: "white", // Ensuring text is visible on dark background
        }}
      >
        {userInfo.id == null ? <p>User not logged in</p> : <p>User ID: {userInfo.id}</p>}
      </div>

      <div className={styles["sidebar-list"]}>
        {conversationContent}
      </div>
    </div>
  );
}

export default ConversationSidebar;
// Export retrieveConversations if it's used elsewhere, otherwise keep it local.
// export { retrieveConversations };
export type { ConversationFetchItem, SideBarDisplayItemProps as SideBarItemProps }; // Exporting updated types
