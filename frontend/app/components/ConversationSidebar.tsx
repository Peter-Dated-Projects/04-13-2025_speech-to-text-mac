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
  onConversationClick: (conversation: ConversationFetchItem) => void;
  userInfo: UserInformation;
}

interface ConversationItemProps {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  onClick: () => void;
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

function updateSidebar() {
  // fetch conversations from the backend
  console.log("Fetching conversations...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/get_objects`;
  console.log("Target URL:", target_url);
  return fetch(target_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      collection: process.env.NEXT_PUBLIC_DB_CONVERSATIONS_COLLECTION,
      filter: {},
    }),
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
    });
}

function createNewConversation(userInfo: UserInformation) {
  // create a new conversation in the database
  console.log("creating new conversation...");

  const target_url = `http://${process.env.NEXT_PUBLIC_BACKEND_HOST}:${process.env.NEXT_PUBLIC_BACKEND_PORT}/storage/create_conversation`;
  console.log("Target URL:", target_url);

  // grab the test user information
  if (!userInfo || !userInfo.id) {
    console.error("User information is not available");
    return Promise.reject(new Error("User information is not available"));
  }

  const testUserID = userInfo.id;
  const information = {
    title: "New Conversation",
    description: "This is a new conversation.",
    participants: [testUserID], // TODO - update this later
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
      // Update sidebar
      console.log("New conversation created:", data);
      return updateSidebar().then((updatedData) => {
        console.log("Updated conversations:", updatedData);
        return updatedData;
      });
    })
    .catch((error) => {
      console.error("Error creating new conversation:", error);
      return null;
    });
}

// ---------------------------------------------------------------- //
// Conversation Sidebar
// ---------------------------------------------------------------- //

function SideBarItem({ id, name, description, updated_at, onClick }: ConversationItemProps) {
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
    <div className={styles["sidebar-list-item"]} onClick={onClick}>
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
  // on load events
  // ------------------------------------------------- //

  useEffect(() => {
    updateSidebar()
      .then((data) => {
        data = data.objects;
        console.log("Conversations data:", data);
        if (data && data.length > 0) {
          const conversation_array = data.map(
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
          setDBConversations(conversation_array);

          console.log("Conversations:", conversation_array);
        } else {
          console.log("No conversations found");
        }
      })
      .catch((error) => {
        console.error("Error fetching conversations:", error);
      });
  }, []); // empty dependency array to run only once on mount

  // ------------------------------------------------- //
  // functions
  // ------------------------------------------------- //

  function toggleSidebar() {
    setShowSidebar(!showSidebar);
  }

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
            updateSidebar()
              .then((data) => {
                data = data.objects;
                console.log("Conversations data:", data);
                if (data && data.length > 0) {
                  const conversation_array = data.map((item: ConversationFetchItem) => ({
                    id: item._id,
                    name: item.title,
                    description: item.description,
                    updated_at: new Date(item.updated_at.$date).toLocaleString(),
                  }));
                  setDBConversations(conversation_array);

                  console.log("Conversations:", conversation_array);
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
          clickFunction={createNewConversation.bind(null, userInfo)}
          css={styles["sidebar-icon-button"]}
        />
      </div>
      <div>{userInfo.id == null ? <p>User not logged in</p> : <p>User ID: {userInfo.id}</p>}</div>
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
export { updateSidebar, SideBarItem };
export type { ConversationItemProps };
export type { ConversationFetchItem };
