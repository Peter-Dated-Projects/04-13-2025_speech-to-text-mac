"use client";
import React, { useEffect } from "react";

import styles from "../styles/page.module.css";

import { SidebarIcon, SearchIcon, NewChatIcon } from "./icons";
import Icon from "./icons";

import { UserInformation } from "../page";

// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

interface ConversationSidebarProps {
  onConversationClick: (conversation: ConversationItemProps) => void;
  userInfo: UserInformation;
}

interface ConversationItemProps {
  id: string;
  name: string;
  description: string;
  updated_at: string;
}

interface ConversationFetchItem {
  _id: string;
  title: string;
  description: string;

  audio_data: string;
  audio_duration: number;
  compressed: boolean;
  // TODO - update this later
  segment_ids: string[];

  created_at: string;
  updated_at: string;

  // TODO - update this later
  participants_ids: string[];
}

// ---------------------------------------------------------------- //
// updateSidebar
// ---------------------------------------------------------------- //

function retrieveConversations(userInfo: UserInformation) {
  // fetch conversations from the backend
  console.log("Fetching conversations...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/get_conversations`;
  const requestType = "GET";
  const requestArgs = {
    user_id: userInfo.id,
  };

  // Create the final request URL with query parameters
  const finalRequestURL = new URL(target_url);
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
      return data;
    })
    .catch((error) => {
      console.error("Error fetching conversations:", error);
      return [];
    })
    .then((data) => {
      // Format data
      console.log("Fetched conversations:", data);
      if (!data.conversations || data.conversations.length === 0) {
        console.warn("No conversations found");
        return [];
      }

      // Map the data to the expected format
      const result = data.conversations.map(
        (item: {
          _id: { $oid: string };
          title: string;
          description: string;
          updated_at: { $date: string };
        }) => ({
          id: item._id.$oid,
          name: item.title,
          description: item.description,
          updated_at: new Date(item.updated_at.$date).toLocaleString(),
        })
      );

      return result;
    });
}

function createNewConversation(userInfo: UserInformation) {
  // grab the test user information
  if (!userInfo || !userInfo.id) {
    console.error("User information is not available");
    return Promise.reject(new Error("User information is not available"));
  }

  // APPROVED - create a new conversation in the database
  console.log("creating new conversation...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/create_conversation`;
  console.log("Target URL:", target_url);

  const information = {
    user_id: userInfo.id,
    data: {
      description: "This is a new conversation.",
      participants: [userInfo.id], // TODO - update this later
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
      // Update sidebar -- no need to query - just add a new item to sidebar
      console.log("New conversation created:", data);

      const conversationItem: ConversationItemProps = {
        id: data._id.$oid,
        name: data.title,
        description: data.description,
        updated_at: new Date(data.updated_at.$date).toLocaleString(),
      };
      return conversationItem;
    })
    .catch((error) => {
      console.error("Error creating new conversation:", error);
      return null;
    });
}

// ---------------------------------------------------------------- //
// Conversation Sidebar
// ---------------------------------------------------------------- //

function SideBarItem({ name, updated_at }: ConversationItemProps) {
  const date = new Date(updated_at);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // get current date
  const currentDate = new Date();

  // check if same day
  const isSameDay =
    date.getDate() === currentDate.getDate() &&
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear();

  return (
    <div
      className={styles["sidebar-list-item"]}
      onClick={() => {
        console.log("Clicked on:", name);
        console.log("CHANGE THIS PLEASE");
      }}
    >
      <h3>{name}</h3>
      <small>Updated at: {isSameDay ? time : date.toDateString()}</small>
    </div>
  );
}

// ---------------------------------------------------------------- //
// Conversation Sidebar
// ---------------------------------------------------------------- //

function ConversationSidebar({ onConversationClick, userInfo }: ConversationSidebarProps) {
  // retrieve all of the conversation objects from database

  const [showSidebar, setShowSidebar] = React.useState(true);
  const [dbConversations, setDBConversations] = React.useState<ConversationItemProps[]>([]);

  // ------------------------------------------------- //
  // functions
  // ------------------------------------------------- //

  function toggleSidebar() {
    setShowSidebar(!showSidebar);
  }

  // ------------------------------------------------- //
  // on load events
  // ------------------------------------------------- //

  useEffect(() => {
    if (!userInfo || !userInfo.id) {
      console.error("[EXPECTED] User information is not available");
      return;
    }

    // update sidebar conversations
    retrieveConversations(userInfo)
      .then((data) => {
        console.log("Conversations data:", data);
        if (data && data.length > 0) {
          setDBConversations(data);

          console.log("Conversations:", data);
        } else {
          console.log("No conversations found");
        }
      })
      .catch((error) => {
        console.error("Error fetching conversations:", error);
      });
  }, [userInfo]); // runs on user info change

  // --------------------------------------------------------------- //
  // Return Object
  // --------------------------------------------------------------- //

  return (
    <div className={styles["sidebar-container"]}>
      <div className={styles["sidebar-header"]}>
        <Icon
          svg={<SidebarIcon />}
          clickFunction={toggleSidebar}
          css={styles["sidebar-icon-button"]}
        />
        {/* <Icon icon="search" svg={<SearchIcon />} onClick={() => {}} /> */}

        {/* MOVE THIS INTO AS SEPARATE FUNCATION */}
        <button
          onClick={() => {
            retrieveConversations(userInfo)
              .then((data) => {
                console.log("Conversations data:", data);
                if (data && data.length > 0) {
                  setDBConversations(data);
                  console.log("Conversations updated:", data);
                } else {
                  console.log("No conversations found");
                }
              })
              .catch((error) => {
                console.error("Error fetching conversations:", error);
              });
          }}
        >
          Refresh
        </button>

        <Icon
          svg={<NewChatIcon />}
          clickFunction={() => {
            createNewConversation(userInfo).then((result) => {
              if (!result) {
                console.error("Failed to create new conversation");
                return;
              }

              // Add the new conversation to the sidebar
              const newArray = [...dbConversations, result];
              setDBConversations(newArray);
            });
          }}
          css={styles["sidebar-icon-button"]}
        />
      </div>

      {/* debug _- show testing user id */}
      <div
        style={{
          padding: "12px 16px",
          border: "1px solid #eee",
          borderRadius: "5px",
          textWrap: "nowrap",
          overflow: "hidden",
          overflowX: "auto",
        }}
      >
        {userInfo.id == null ? <p>User not logged in</p> : <p>User ID: {userInfo.id}</p>}
      </div>

      {/* Sidebar list */}
      <div className={styles["sidebar-list"]}>
        {dbConversations.map((conversation, i) => (
          <SideBarItem
            key={i}
            id={conversation.id}
            name={conversation.name}
            description={conversation.description}
            updated_at={conversation.updated_at}
            onClick={() => onConversationClick(conversation)}
          />
        ))}
      </div>
    </div>
  );
}

export default ConversationSidebar;
export { retrieveConversations, SideBarItem };
export type { ConversationItemProps };
export type { ConversationFetchItem };
